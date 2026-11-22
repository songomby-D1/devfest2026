import type {
  MintPatch,
  MintRequestRecord,
  NewMintRequest,
} from './mint-request';

/** Result of an insert under the two uniqueness rules of `mint_requests`. */
export type CreateMintResult =
  | { readonly kind: 'created'; readonly record: MintRequestRecord }
  /** The requester already used this idempotency key. */
  | { readonly kind: 'key_exists'; readonly record: MintRequestRecord }
  /** Another request of the item is pending or confirmed. */
  | { readonly kind: 'item_busy' };

/** Persistence of mint requests (NFT database, D04). */
export interface MintRepository {
  findById(id: string): Promise<MintRequestRecord | null>;
  findByKey(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<MintRequestRecord | null>;
  /** The pending or confirmed request of an item, if any. */
  findLiveForContent(contentId: string): Promise<MintRequestRecord | null>;
  /** The live request, otherwise the latest failed one. */
  findLatestForContent(contentId: string): Promise<MintRequestRecord | null>;
  /** Inserts atomically: concurrent duplicates resolve to one row. */
  create(input: NewMintRequest): Promise<CreateMintResult>;
  /** Oldest pending requests first. */
  listPending(limit: number): Promise<readonly MintRequestRecord[]>;
  /**
   * Applies `patch` only while the request is still `pending`. Returns the
   * updated row, or `null` when it was no longer pending.
   */
  updatePending(
    id: string,
    patch: MintPatch,
  ): Promise<MintRequestRecord | null>;
}

export const MINT_REPOSITORY = Symbol('MINT_REPOSITORY');
