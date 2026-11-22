import { randomUUID } from 'node:crypto';
import type {
  CreateMintResult,
  MintRepository,
} from '../../src/mint/mint-repository';
import type {
  MintPatch,
  MintRequestRecord,
  NewMintRequest,
} from '../../src/mint/mint-request';

/** `mint_requests` in memory, with the same two uniqueness rules. */
export class InMemoryMintRepository implements MintRepository {
  readonly rows = new Map<string, MintRequestRecord>();
  private clock = Date.parse('2026-11-22T10:00:00.000Z');

  private now(): Date {
    this.clock += 1000;
    return new Date(this.clock);
  }

  findById(id: string): Promise<MintRequestRecord | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByKey(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<MintRequestRecord | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (row) =>
          row.requesterId === requesterId &&
          row.idempotencyKey === idempotencyKey,
      ) ?? null,
    );
  }

  findLiveForContent(contentId: string): Promise<MintRequestRecord | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (row) => row.contentId === contentId && row.status !== 'failed',
      ) ?? null,
    );
  }

  async findLatestForContent(
    contentId: string,
  ): Promise<MintRequestRecord | null> {
    const live = await this.findLiveForContent(contentId);
    if (live !== null) return live;
    const rows = [...this.rows.values()]
      .filter((row) => row.contentId === contentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return rows[0] ?? null;
  }

  async create(input: NewMintRequest): Promise<CreateMintResult> {
    const existing = await this.findByKey(
      input.requesterId,
      input.idempotencyKey,
    );
    if (existing !== null) return { kind: 'key_exists', record: existing };
    if ((await this.findLiveForContent(input.contentId)) !== null) {
      return { kind: 'item_busy' };
    }
    const now = this.now();
    const record: MintRequestRecord = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      attempts: 0,
      tokenUri: null,
      metadataCid: null,
      masterHash: null,
      txHash: null,
      tokenId: null,
      failureCode: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      confirmedAt: null,
      failedAt: null,
    };
    this.rows.set(record.id, record);
    return { kind: 'created', record };
  }

  listPending(limit: number): Promise<readonly MintRequestRecord[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.status === 'pending')
        .slice(0, limit),
    );
  }

  updatePending(
    id: string,
    patch: MintPatch,
  ): Promise<MintRequestRecord | null> {
    const row = this.rows.get(id);
    if (row?.status !== 'pending') return Promise.resolve(null);
    const updated = { ...row, ...patch, updatedAt: this.now() };
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  /** Inserts a row as it would be after an earlier run (restart tests). */
  seed(record: MintRequestRecord): void {
    this.rows.set(record.id, record);
  }
}
