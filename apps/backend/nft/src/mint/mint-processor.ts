import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  BLOCKCHAIN_PORT,
  type BlockchainPort,
  ChainError,
} from '../blockchain/blockchain.port';
import { AppConfigService } from '../config/app-config.service';
import {
  CONTRACT_CATEGORIES,
  METADATA_PUBLISHER,
  type MetadataPublisher,
  type PreparedMetadata,
} from '../metadata/metadata-publisher.port';
import { FINAL_FAILURES, type MintFailureCode } from './mint-failure';
import { MINT_REPOSITORY, type MintRepository } from './mint-repository';
import type { MintPatch, MintRequestRecord } from './mint-request';

/** Contract limits of `safeMint` (`MAX_TITLE_BYTES`, non-zero hash). */
const MAX_TITLE_BYTES = 256;
const MASTER_HASH = /^0x[0-9a-f]{64}$/;
const ZERO_HASH = `0x${'0'.repeat(64)}`;

/** Pending requests resumed per sweep. */
const RESUME_BATCH = 100;
/** Longest wait for the in-flight request at shutdown. */
const SHUTDOWN_GRACE_MS = 5_000;

/** The request stopped being pending while it was processed. */
class NoLongerPending extends Error {}

/** An error with the failure code it maps to. */
class MintStepError extends Error {
  constructor(
    readonly code: MintFailureCode,
    message: string,
  ) {
    super(message);
  }
}

function codeOf(error: unknown): MintFailureCode {
  if (error instanceof MintStepError) return error.code;
  if (error instanceof ChainError) return error.code;
  return 'UNKNOWN';
}

function nameOf(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'error';
}

function checkPrepared(prepared: PreparedMetadata, contentId: string): void {
  const problems = [
    prepared.contentId.toLowerCase() !== contentId ? 'contentId' : undefined,
    !prepared.tokenUri.startsWith('ipfs://') ? 'tokenUri' : undefined,
    !MASTER_HASH.test(prepared.masterHash) || prepared.masterHash === ZERO_HASH
      ? 'masterHash'
      : undefined,
    prepared.title.length === 0 ||
    Buffer.byteLength(prepared.title, 'utf8') > MAX_TITLE_BYTES
      ? 'title'
      : undefined,
    !(CONTRACT_CATEGORIES as readonly string[]).includes(prepared.category)
      ? 'category'
      : undefined,
  ].filter((problem) => problem !== undefined);
  if (problems.length > 0) {
    throw new MintStepError(
      'INVALID_METADATA',
      `Prepared metadata is invalid: ${problems.join(', ')}`,
    );
  }
}

/**
 * Background mint worker inside the service (D16: no shared queue).
 *
 * - One request at a time: the gallery wallet signs every transaction, so
 *   serial sends keep its nonces in order. Run one service replica.
 * - Restart-safe: on boot and on each sweep it resumes every `pending`
 *   request. A request with a saved `txHash` waits for its receipt; one
 *   without is submitted. The `txHash` is saved before the wait.
 * - The contract allows one token per item (invariant I1). Before a send,
 *   and after a revert or a dropped transaction, the worker reads
 *   `tokenByArtwork` and confirms with the existing token instead of
 *   failing, so a crash between send and save never ends in a double mint
 *   or a false failure.
 * - Transient errors (RPC, metadata) leave the request pending for the next
 *   sweep, up to `MINT_MAX_ATTEMPTS`; contract and funding errors are final.
 */
@Injectable()
export class MintProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MintProcessor.name);
  private readonly queued = new Set<string>();
  private tail: Promise<void> = Promise.resolve();
  private timer: NodeJS.Timeout | undefined;
  private stopping = false;

  constructor(
    @Inject(MINT_REPOSITORY) private readonly repository: MintRepository,
    @Inject(BLOCKCHAIN_PORT) private readonly chain: BlockchainPort,
    @Inject(METADATA_PUBLISHER) private readonly publisher: MetadataPublisher,
    private readonly config: AppConfigService,
  ) {}

  onApplicationBootstrap(): void {
    void this.resumePending();
    const interval = this.config.mint.sweepIntervalMs;
    if (interval > 0) {
      this.timer = setInterval(() => void this.resumePending(), interval);
      this.timer.unref();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    await Promise.race([
      this.tail,
      new Promise<void>((resolve) =>
        setTimeout(resolve, SHUTDOWN_GRACE_MS).unref(),
      ),
    ]);
  }

  /** Schedules a request. A request already queued is not added twice. */
  enqueue(id: string): void {
    if (this.stopping || this.queued.has(id)) return;
    this.queued.add(id);
    this.tail = this.tail.then(async () => {
      try {
        if (!this.stopping) await this.process(id);
      } catch (error) {
        this.logger.error(`Mint ${id} processing crashed: ${nameOf(error)}`);
      } finally {
        this.queued.delete(id);
      }
    });
  }

  /** Resolves once every queued request has been processed (tests, shutdown). */
  whenIdle(): Promise<void> {
    return this.tail;
  }

  /** Queues every pending request. Errors are logged; the next sweep retries. */
  async resumePending(): Promise<void> {
    try {
      const pending = await this.repository.listPending(RESUME_BATCH);
      for (const record of pending) this.enqueue(record.id);
    } catch (error) {
      this.logger.warn(`Could not list pending mints: ${nameOf(error)}`);
    }
  }

  /** One pass over a pending request. Never throws for chain failures. */
  async process(id: string): Promise<void> {
    const record = await this.repository.findById(id);
    if (record === null || record.status !== 'pending') return;
    try {
      await this.advance(record);
    } catch (error) {
      if (error instanceof NoLongerPending) return;
      await this.recordError(record, error);
    }
  }

  private async advance(start: MintRequestRecord): Promise<void> {
    let record = start;
    if (record.txHash !== null) {
      if (await this.settle(record, record.txHash)) return;
      // Dropped and never mined: send again.
      record = await this.save(record, { txHash: null, submittedAt: null });
    }

    const existing = await this.chain.findTokenByArtwork(record.contentId);
    if (existing !== null) {
      await this.confirm(record, existing, null);
      return;
    }

    let prepared: PreparedMetadata;
    try {
      prepared = await this.publisher.prepare(record.contentId, {
        requestId: record.requestId,
      });
    } catch (error) {
      throw new MintStepError(
        'METADATA_UNAVAILABLE',
        `Metadata preparation failed: ${nameOf(error)}`,
      );
    }
    checkPrepared(prepared, record.contentId);
    record = await this.save(record, {
      tokenUri: prepared.tokenUri,
      metadataCid: prepared.metadataCid,
      masterHash: prepared.masterHash,
    });

    const outcome = await this.chain.submitMint({
      contentId: record.contentId,
      tokenUri: prepared.tokenUri,
      title: prepared.title,
      category: prepared.category,
      masterHash: prepared.masterHash,
    });
    if (outcome.kind === 'already_minted') {
      await this.confirm(record, outcome.tokenId, null);
      return;
    }
    // Saved before waiting, so a restart resumes this transaction.
    record = await this.save(record, {
      txHash: outcome.txHash,
      submittedAt: new Date(),
    });
    this.logger.log(`Mint ${record.id} sent: ${outcome.txHash}`);
    await this.settle(record, outcome.txHash);
  }

  /**
   * Waits for the receipt. Returns `false` only when the transaction is
   * unknown to the node and no token exists, so the caller sends again.
   */
  private async settle(
    record: MintRequestRecord,
    txHash: string,
  ): Promise<boolean> {
    const outcome = await this.chain.waitForMint(
      txHash,
      this.config.chain.txTimeoutMs,
    );
    switch (outcome.kind) {
      case 'confirmed':
        await this.confirm(record, outcome.tokenId, txHash);
        return true;
      case 'pending':
        // Still in the mempool: the next sweep waits again.
        this.logger.warn(`Mint ${record.id} still pending on-chain`);
        return true;
      case 'reverted':
      case 'dropped': {
        const tokenId = await this.chain.findTokenByArtwork(record.contentId);
        if (tokenId !== null) {
          // Another transaction minted it (e.g. a resend after a crash).
          await this.confirm(record, tokenId, null);
          return true;
        }
        if (outcome.kind === 'dropped') return false;
        throw new MintStepError('CONTRACT_REVERTED', 'safeMint reverted');
      }
    }
  }

  private async confirm(
    record: MintRequestRecord,
    tokenId: string,
    txHash: string | null,
  ): Promise<void> {
    await this.save(record, {
      status: 'confirmed',
      tokenId,
      txHash,
      failureCode: null,
      confirmedAt: new Date(),
    });
    this.logger.log(
      `Mint ${record.id} confirmed: token ${tokenId}` +
        (txHash === null ? ' (reconciled with the existing token)' : ''),
    );
  }

  private async recordError(
    record: MintRequestRecord,
    error: unknown,
  ): Promise<void> {
    const code = codeOf(error);
    const attempts = record.attempts + 1;
    const final =
      FINAL_FAILURES.has(code) || attempts >= this.config.mint.maxAttempts;
    this.logger.warn(
      `Mint ${record.id} attempt ${String(attempts)} failed (${code}${final ? ', final' : ''}): ${nameOf(error)}`,
    );
    const patch: MintPatch = final
      ? { attempts, status: 'failed', failureCode: code, failedAt: new Date() }
      : { attempts, failureCode: code };
    try {
      await this.repository.updatePending(record.id, patch);
    } catch (saveError) {
      this.logger.error(
        `Mint ${record.id} failure could not be saved: ${nameOf(saveError)}`,
      );
    }
  }

  private async save(
    record: MintRequestRecord,
    patch: MintPatch,
  ): Promise<MintRequestRecord> {
    const updated = await this.repository.updatePending(record.id, patch);
    if (updated === null) throw new NoLongerPending();
    return updated;
  }
}
