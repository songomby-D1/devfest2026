import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  BLOCKCHAIN_PORT,
  type BlockchainPort,
} from '../blockchain/blockchain.port';
import { PublicError, safeRequestId } from '../common/public-error';
import { AppConfigService } from '../config/app-config.service';
import {
  CONTENT_ERRORS,
  ContentReferenceService,
} from '../content/content-reference.service';
import { MINT_REPOSITORY, type MintRepository } from '../mint/mint-repository';
import type { MintRequestRecord } from '../mint/mint-request';
import {
  toProvenanceMintView,
  toProvenanceView,
  type ProvenanceView,
  type VerificationView,
} from './provenance-view';

/** Public error codes of the provenance route. */
export const PROVENANCE_ERRORS = {
  NOT_FOUND: 'NOT_FOUND',
  NFT_UNAVAILABLE: 'NFT_UNAVAILABLE',
} as const;

/** The on-chain verification gives up after this long. */
export const CHAIN_READ_TIMEOUT_MS = 3_000;

/** Optional overrides, for tests. */
export interface ProvenanceOptions {
  readonly chainTimeoutMs?: number;
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
 * Provenance display data of a published item (NFT-05), behind the frozen
 * `GET /internal/v1/provenance/{contentId}`. The item must be published: an
 * unknown, draft or unpublished item answers the same `404`, so a draft's
 * existence never leaks. The chain read is best effort: when it fails, the
 * record is returned as stored with `verification.state` `unverifiable`.
 */
@Injectable()
export class ProvenanceService {
  private readonly logger = new Logger(ProvenanceService.name);
  private readonly chainTimeoutMs: number;

  constructor(
    private readonly references: ContentReferenceService,
    @Inject(MINT_REPOSITORY) private readonly mints: MintRepository,
    @Inject(BLOCKCHAIN_PORT) private readonly chain: BlockchainPort,
    private readonly config: AppConfigService,
    @Optional()
    @Inject(PROVENANCE_OPTIONS)
    options: ProvenanceOptions | undefined,
  ) {
    this.chainTimeoutMs = options?.chainTimeoutMs ?? CHAIN_READ_TIMEOUT_MS;
  }

  async read(contentId: string, requestId?: string): Promise<ProvenanceView> {
    const safeId = safeRequestId(requestId);
    await this.assertPublic(contentId, safeId);

    const id = contentId.toLowerCase();
    let record: MintRequestRecord | null;
    try {
      record = await this.mints.findLatestForContent(id);
    } catch (error) {
      this.logger.error(
        `Mint records could not be read: ${errorName(error)} (request ${safeId})`,
      );
      throw new PublicError(
        PROVENANCE_ERRORS.NFT_UNAVAILABLE,
        'The provenance service is unavailable, try again later',
        HttpStatus.SERVICE_UNAVAILABLE,
        safeId,
      );
    }
    if (record === null) return toProvenanceView(id, null);

    const verification =
      record.status === 'confirmed'
        ? await this.verify(record, safeId)
        : undefined;
    const options = {
      explorerBaseUrl: this.config.chain.explorerBaseUrl,
      ipfsGatewayUrl: this.config.ipfs.gatewayUrl,
    };
    return toProvenanceView(
      id,
      toProvenanceMintView(record, options, verification),
    );
  }

  /**
   * Published items only. `VALIDATION_FAILED` (400) and
   * `CONTENT_UNAVAILABLE` (503) pass through; unknown and unpublished
   * items become the same `404 NOT_FOUND`.
   */
  private async assertPublic(
    contentId: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.references.assertPublished(contentId, { requestId });
    } catch (error) {
      if (
        error instanceof PublicError &&
        (error.code === CONTENT_ERRORS.CONTENT_NOT_FOUND ||
          error.code === CONTENT_ERRORS.CONTENT_NOT_PUBLISHED)
      ) {
        throw new PublicError(
          PROVENANCE_ERRORS.NOT_FOUND,
          'The item does not exist',
          HttpStatus.NOT_FOUND,
          requestId,
        );
      }
      throw error;
    }
  }

  /** Compares the stored record with the chain. Never throws. */
  private async verify(
    record: MintRequestRecord,
    requestId: string,
  ): Promise<VerificationView> {
    const checkedAt = new Date().toISOString();
    const unverifiable: VerificationView = {
      state: 'unverifiable',
      fixity: null,
      onChain: null,
      checkedAt,
    };
    const tokenId = record.tokenId;
    const masterHash = record.masterHash?.toLowerCase() ?? null;
    if (
      tokenId === null ||
      !TOKEN_ID.test(tokenId) ||
      masterHash === null ||
      !HASH.test(masterHash)
    ) {
      // A token found by reconciliation may have no recorded hash.
      return unverifiable;
    }

    try {
      const [artwork, fixity, tokenUri, owner] = await withTimeout(
        Promise.all([
          this.chain.getArtwork(tokenId),
          this.chain.verifyFixity(tokenId, masterHash),
          this.chain.tokenUri(tokenId),
          this.chain.ownerOf(tokenId),
        ]),
        this.chainTimeoutMs,
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
          owner,
        },
        checkedAt,
      };
    } catch (error) {
      this.logger.warn(
        `On-chain verification of token ${tokenId} failed: ${errorName(error)} (request ${requestId})`,
      );
      return unverifiable;
    }
  }
}
