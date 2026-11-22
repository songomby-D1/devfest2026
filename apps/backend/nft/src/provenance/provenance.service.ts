import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PublicError, safeRequestId } from '../common/public-error';
import {
  CONTENT_ERRORS,
  ContentReferenceService,
} from '../content/content-reference.service';
import {
  CHAIN_PROVENANCE_READER,
  type ChainProvenanceReader,
  MINT_RECORD_READER,
  type MintRecordReader,
  type ProvenanceMintRecord,
} from './provenance.ports';
import {
  toMintView,
  toProvenanceView,
  type ProvenanceView,
  type VerificationView,
  type ViewOptions,
} from './provenance-view';

/** Public error codes of the provenance route. */
export const PROVENANCE_ERRORS = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONTENT_UNAVAILABLE: 'CONTENT_UNAVAILABLE',
  NFT_UNAVAILABLE: 'NFT_UNAVAILABLE',
} as const;

export interface ProvenanceOptions extends ViewOptions {
  /** Budget of the whole on-chain verification. */
  readonly chainTimeoutMs: number;
}

export const PROVENANCE_OPTIONS = Symbol('PROVENANCE_OPTIONS');

const HASH = /^0x[0-9a-fA-F]{64}$/;
const TOKEN_ID = /^[0-9]{1,78}$/;

class ChainTimeoutError extends Error {
  constructor() {
    super('Chain read timed out');
    this.name = 'ChainTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ChainTimeoutError());
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'error';
}

/**
 * Provenance display data of a published item (NFT-05). The item must be
 * published: an unknown, draft or unpublished item answers the same `404`,
 * so a draft's existence never leaks. The chain read is best effort: when it
 * fails, the record is returned as stored with `verification.state`
 * `unverifiable`.
 */
@Injectable()
export class ProvenanceService {
  private readonly logger = new Logger(ProvenanceService.name);

  constructor(
    @Inject(ContentReferenceService)
    private readonly references: ContentReferenceService,
    @Inject(MINT_RECORD_READER) private readonly mints: MintRecordReader,
    @Inject(CHAIN_PROVENANCE_READER)
    private readonly chain: ChainProvenanceReader,
    @Inject(PROVENANCE_OPTIONS) private readonly options: ProvenanceOptions,
  ) {}

  async read(
    contentId: string,
    context: { readonly requestId?: string | undefined } = {},
  ): Promise<ProvenanceView> {
    const requestId = safeRequestId(context.requestId);
    await this.assertPublic(contentId, requestId);

    const id = contentId.toLowerCase();
    let record: ProvenanceMintRecord | null;
    try {
      record = await this.mints.findLatestForContent(id);
    } catch (error) {
      this.logger.error(
        `Mint records could not be read: ${errorName(error)} (request ${requestId})`,
      );
      throw new PublicError(
        PROVENANCE_ERRORS.NFT_UNAVAILABLE,
        'The provenance service is unavailable, try again later',
        HttpStatus.SERVICE_UNAVAILABLE,
        requestId,
      );
    }
    if (record === null) return toProvenanceView(id, null);

    const verification =
      record.status === 'confirmed'
        ? await this.verify(record, requestId)
        : undefined;
    return toProvenanceView(id, toMintView(record, this.options, verification));
  }

  /** Published items only; everything else is the same `404`. */
  private async assertPublic(
    contentId: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.references.assertPublished(contentId, { requestId });
    } catch (error) {
      if (!(error instanceof PublicError)) throw error;
      switch (error.code) {
        case CONTENT_ERRORS.CONTENT_NOT_FOUND:
        case CONTENT_ERRORS.CONTENT_NOT_PUBLISHED:
          throw new PublicError(
            PROVENANCE_ERRORS.NOT_FOUND,
            'The item does not exist',
            HttpStatus.NOT_FOUND,
            requestId,
          );
        default:
          // VALIDATION_FAILED (400) and CONTENT_UNAVAILABLE (503) as is.
          throw error;
      }
    }
  }

  /** Compares the stored record with the chain. Never throws. */
  private async verify(
    record: ProvenanceMintRecord,
    requestId: string,
  ): Promise<VerificationView> {
    const checkedAt = new Date().toISOString();
    const tokenId = record.tokenId;
    const masterHash = record.masterHash?.toLowerCase() ?? null;
    if (
      tokenId === null ||
      !TOKEN_ID.test(tokenId) ||
      masterHash === null ||
      !HASH.test(masterHash)
    ) {
      this.logger.warn(
        `Confirmed mint ${record.id} lacks a token ID or master hash (request ${requestId})`,
      );
      return { state: 'unverifiable', fixity: null, onChain: null, checkedAt };
    }

    try {
      const [artwork, fixity, tokenUri] = await withTimeout(
        Promise.all([
          this.chain.getArtwork(tokenId),
          this.chain.verifyFixity(tokenId, masterHash),
          this.chain.tokenUri(tokenId),
        ]),
        this.options.chainTimeoutMs,
      );
      if (artwork === null) {
        this.logger.warn(
          `Token ${tokenId} of mint ${record.id} does not exist on-chain (request ${requestId})`,
        );
        return { state: 'mismatch', fixity: false, onChain: null, checkedAt };
      }
      const matches =
        fixity &&
        artwork.masterHash.toLowerCase() === masterHash &&
        tokenUri !== null &&
        tokenUri === record.tokenUri;
      return {
        state: matches ? 'verified' : 'mismatch',
        fixity,
        onChain: {
          title: artwork.title,
          category: artwork.category,
          mintedAt: artwork.mintedAt.toISOString(),
          masterHash: artwork.masterHash.toLowerCase(),
          tokenUri,
        },
        checkedAt,
      };
    } catch (error) {
      this.logger.warn(
        `On-chain verification of token ${tokenId} failed: ${errorName(error)} (request ${requestId})`,
      );
      return { state: 'unverifiable', fixity: null, onChain: null, checkedAt };
    }
  }
}
