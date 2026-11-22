import type {
  ItemChanges,
  ItemListFilter,
  ItemRecord,
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
   * Applies the changes atomically, only while the item is not published.
   * Returns `null` when the item is missing or was published meanwhile.
   */
  updateUnpublished(
    id: string,
    changes: ItemChanges,
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
}
