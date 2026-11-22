import type { ItemChanges, ItemRecord, NewItem } from './item';

export const ITEM_REPOSITORY = Symbol('ITEM_REPOSITORY');

export interface ItemRepository {
  /** Creates the author, item and description atomically. */
  create(item: NewItem): Promise<ItemRecord>;

  findById(id: string): Promise<ItemRecord | null>;

  /**
   * Applies the changes atomically, only while the item is not published.
   * Returns `null` when the item is missing or was published meanwhile.
   */
  updateUnpublished(
    id: string,
    changes: ItemChanges,
  ): Promise<ItemRecord | null>;
}
