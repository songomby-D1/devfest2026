import { randomUUID } from 'node:crypto';
import type { ItemChanges, ItemRecord, NewItem } from '../../src/items/item';
import type { ItemRepository } from '../../src/items/item-repository';

/** Repository double with the same atomicity and status rules as Prisma. */
export class InMemoryItemRepository implements ItemRepository {
  readonly items = new Map<string, ItemRecord>();
  private clock = Date.UTC(2026, 10, 22, 8, 0, 0);

  private now(): Date {
    this.clock += 1000;
    return new Date(this.clock);
  }

  create(item: NewItem): Promise<ItemRecord> {
    const now = this.now();
    const record: ItemRecord = {
      id: randomUUID(),
      ownerId: item.ownerId,
      ...item.metadata,
      author: { ...item.author },
      rights: { ...item.rights },
      description: { text: item.descriptionText, claimStatus: 'unreviewed' },
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      claimStatus: 'unreviewed',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return Promise.resolve(record);
  }

  findById(id: string): Promise<ItemRecord | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  updateUnpublished(
    id: string,
    changes: ItemChanges,
  ): Promise<ItemRecord | null> {
    const current = this.items.get(id);
    if (current === undefined || current.publicationStatus === 'published') {
      return Promise.resolve(null);
    }
    const updated: ItemRecord = {
      ...current,
      ...changes.metadata,
      author: { ...current.author, ...changes.author },
      rights: { ...current.rights, ...changes.rights },
      description: {
        text: changes.descriptionText ?? current.description.text,
        claimStatus: changes.resetDescriptionClaim
          ? 'unreviewed'
          : current.description.claimStatus,
      },
      claimStatus: changes.resetItemClaim ? 'unreviewed' : current.claimStatus,
      updatedAt: this.now(),
    };
    this.items.set(id, updated);
    return Promise.resolve(updated);
  }

  /** Test helper standing in for the review and publication tasks. */
  patchRecord(id: string, fields: Partial<ItemRecord>): void {
    const current = this.items.get(id);
    if (current === undefined) throw new Error(`No item ${id}`);
    this.items.set(id, { ...current, ...fields });
  }
}
