import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BLOCKCHAIN_PORT,
  type BlockchainPort,
} from '../blockchain/blockchain.port';
import type { CallerContext } from '../common/caller-context';
import { PublicError } from '../common/public-error';
import { AppConfigService } from '../config/app-config.service';
import { ContentReferenceService } from '../content/content-reference.service';
import { MintProcessor } from './mint-processor';
import { MINT_REPOSITORY, type MintRepository } from './mint-repository';
import type { MintRequestRecord } from './mint-request';
import { type MintView, toMintView } from './mint-view';

/** Same rule as the gateway (gateway.openapi.yaml, `Idempotency-Key`). */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const startMintSchema = z.object({
  contentId: z.string().regex(UUID, 'must be a UUID'),
});

/** Public error codes of the mint routes, beyond those of `ContentReferenceService`. */
export const MINT_ERRORS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  MINT_ALREADY_REQUESTED: 'MINT_ALREADY_REQUESTED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export interface StartMintResult {
  /** `true` for a new request (202), `false` for a replayed key (200). */
  readonly created: boolean;
  readonly mint: MintView;
}

/**
 * The owner's mint journey (NFT-04): start a mint of a published item
 * (S1), then poll its status (D16). The chain work runs in `MintProcessor`.
 */
@Injectable()
export class MintService {
  constructor(
    @Inject(MINT_REPOSITORY) private readonly repository: MintRepository,
    @Inject(BLOCKCHAIN_PORT) private readonly chain: BlockchainPort,
    private readonly references: ContentReferenceService,
    private readonly processor: MintProcessor,
    private readonly config: AppConfigService,
  ) {}

  async start(
    caller: CallerContext,
    idempotencyKey: string | undefined,
    body: unknown,
  ): Promise<StartMintResult> {
    const { requestId } = caller;
    const userId = caller.userId;
    if (userId === null) {
      throw new PublicError(
        MINT_ERRORS.UNAUTHENTICATED,
        'Sign in to request a certificate',
        HttpStatus.UNAUTHORIZED,
        requestId,
      );
    }
    if (idempotencyKey === undefined || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new PublicError(
        MINT_ERRORS.IDEMPOTENCY_KEY_REQUIRED,
        'An Idempotency-Key header of 16 to 128 letters, digits, "-" or "_" is required',
        HttpStatus.BAD_REQUEST,
        requestId,
      );
    }
    const parsed = startMintSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicError(
        MINT_ERRORS.VALIDATION_FAILED,
        'The request is invalid',
        HttpStatus.BAD_REQUEST,
        requestId,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          reason: issue.message,
        })),
      );
    }
    const contentId = parsed.data.contentId.toLowerCase();

    // A replayed key returns its mint without new checks or side effects.
    const replay = await this.repository.findByKey(userId, idempotencyKey);
    if (replay !== null) return this.replayed(replay, contentId, requestId);

    await this.references.assertPublished(contentId, { requestId });
    await this.references.assertOwner(
      contentId,
      { userId, permissions: caller.permissions },
      { requestId },
    );
    const live = await this.repository.findLiveForContent(contentId);
    if (live !== null) {
      // A concurrent request with the same key may have just created it.
      if (
        live.requesterId === userId &&
        live.idempotencyKey === idempotencyKey
      ) {
        return this.replayed(live, contentId, requestId);
      }
      throw this.alreadyRequested(requestId);
    }

    const result = await this.repository.create({
      contentId,
      requesterId: userId,
      idempotencyKey,
      chainId: this.chain.network.chainId,
      contractAddress: this.chain.network.contractAddress,
      requestId,
    });
    switch (result.kind) {
      case 'created':
        this.processor.enqueue(result.record.id);
        return { created: true, mint: this.view(result.record) };
      case 'key_exists':
        return this.replayed(result.record, contentId, requestId);
      case 'item_busy':
        throw this.alreadyRequested(requestId);
    }
  }

  /** A mint of the caller, by ID. Other users get 404. */
  async get(caller: CallerContext, mintId: string): Promise<MintView> {
    const record = UUID.test(mintId)
      ? await this.repository.findById(mintId.toLowerCase())
      : null;
    if (
      record === null ||
      caller.userId === null ||
      record.requesterId !== caller.userId
    ) {
      throw new PublicError(
        MINT_ERRORS.NOT_FOUND,
        'The certificate request does not exist',
        HttpStatus.NOT_FOUND,
        caller.requestId,
      );
    }
    return this.view(record);
  }

  private replayed(
    record: MintRequestRecord,
    contentId: string,
    requestId: string,
  ): StartMintResult {
    if (record.contentId !== contentId) {
      throw new PublicError(
        MINT_ERRORS.IDEMPOTENCY_KEY_REUSED,
        'This Idempotency-Key was already used for another item',
        HttpStatus.UNPROCESSABLE_ENTITY,
        requestId,
      );
    }
    return { created: false, mint: this.view(record) };
  }

  private alreadyRequested(requestId: string): PublicError {
    return new PublicError(
      MINT_ERRORS.MINT_ALREADY_REQUESTED,
      'This item already has a certificate or a request in progress',
      HttpStatus.CONFLICT,
      requestId,
    );
  }

  private view(record: MintRequestRecord): MintView {
    return toMintView(record, this.config.chain.explorerBaseUrl);
  }
}
