import type {
  ClaimReviewChange,
  ItemChanges,
  ItemListFilter,
  ItemRecord,
  MediaChange,
  MediaChangeResult,
  NewItem,
  PublicationTransition,
} from './item';

export const ITEM_REPOSITORY = Symbol('ITEM_REPOSITORY');

export interface ItemRepository {
  /** Creates the author, item and description atomically. */
  create(item: NewItem): Promise<ItemRecord>;

  findById(id: string): Promise<ItemRecord | null>;

  /** Returns up to `filter.limit` items in the filter's order. */
  list(filter: ItemListFilter): Promise<ItemRecord[]>;

  /**
   * Locks the item, passes its current state to `decide` and applies the
   * returned owner edit in the same transaction: the claim resets it carries
   * and, for a real change, the move of a `returned` or `accepted`
   * submission back `in_review` (CONTENT-04). `decide` returns `null` for no
   * change and may throw to abort. Returns `null` only when the item does
   * not exist.
   */
  changeDetails(
    id: string,
    decide: (current: ItemRecord) => ItemChanges | null,
  ): Promise<ItemRecord | null>;

  /**
   * Locks the item, passes its current state to `decide` and records the
   * returned claim review in the same transaction: the target's claim status
   * becomes the outcome and the review history keeps the previous status.
   * This is the only write of a `verified` or `uncertain` claim status
   * (CONTENT-04). `decide` may throw to abort. Returns `null` only when the
   * item does not exist.
   */
  reviewClaim(
    id: string,
    decide: (current: ItemRecord) => ClaimReviewChange,
  ): Promise<ItemRecord | null>;

  /**
   * Locks the item, passes its current state to `decide` and applies the
   * returned transition with its history event in the same transaction.
   * `decide` returns `null` for no change and may throw to abort. Returns
   * `null` only when the item does not exist.
   */
  changePublication(
    id: string,
    decide: (current: ItemRecord) => PublicationTransition | null,
  ): Promise<ItemRecord | null>;

  /**
   * Locks the item, passes its current state to `decide` and applies the
   * returned media change in the same transaction, together with the reset
   * of the item claim to `unreviewed` (D18), the move of a `returned` or
   * `accepted` submission back `in_review` (CONTENT-04) and, once advisory
   * signals exist
   * (CONTENT-06), marking the affected signals stale. `decide` may throw to
   * abort. Returns `null` only when the item does not exist.
   */
  changeMedia(
    id: string,
    decide: (current: ItemRecord) => MediaChange,
  ): Promise<MediaChangeResult | null>;
}
