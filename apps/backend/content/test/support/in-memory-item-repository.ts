import { randomUUID } from 'node:crypto';
import type {
  ItemChanges,
  ItemListFilter,
  ItemPosition,
  ItemRecord,
  MediaChange,
  MediaChangeResult,
  MediaRecord,
  NewItem,
  PublicationTransition,
} from '../../src/items/item';
import type { ItemRepository } from '../../src/items/item-repository';

/** Repository double with the same atomicity and status rules as Prisma. */
export class InMemoryItemRepository implements ItemRepository {
  readonly items = new Map<string, ItemRecord>();
  readonly events: (Pick<
    PublicationTransition,
    'action' | 'actorId' | 'note'
  > & {
    readonly itemId: string;
  })[] = [];
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
      media: [],
    };
    this.items.set(record.id, record);
    return Promise.resolve(record);
  }

  findById(id: string): Promise<ItemRecord | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  list(filter: ItemListFilter): Promise<ItemRecord[]> {
    const sign = filter.order === 'newest_first' ? -1 : 1;
    // Lowercase UUID strings sort like PostgreSQL's uuid type.
    const compare = (a: ItemPosition, b: ItemPosition): number =>
      sign *
      (a.createdAt.getTime() - b.createdAt.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const text = filter.text?.toLowerCase();
    const matches = (item: ItemRecord): boolean =>
      (filter.publicationStatus === undefined ||
        item.publicationStatus === filter.publicationStatus) &&
      (filter.submissionStatus === undefined ||
        item.submissionStatus === filter.submissionStatus) &&
      (filter.ownerId === undefined || item.ownerId === filter.ownerId) &&
      (filter.excludeOwnerId === undefined ||
        item.ownerId !== filter.excludeOwnerId) &&
      (filter.kind === undefined || item.kind === filter.kind) &&
      (text === undefined ||
        item.title.toLowerCase().includes(text) ||
        (item.author.name?.toLowerCase().includes(text) ?? false)) &&
      (filter.after === undefined || compare(item, filter.after) > 0);
    return Promise.resolve(
      [...this.items.values()]
        .filter(matches)
        .sort(compare)
        .slice(0, filter.limit),
    );
  }

  changePublication(
    id: string,
    decide: (current: ItemRecord) => PublicationTransition | null,
  ): Promise<ItemRecord | null> {
    // An error thrown by `decide` becomes a rejection, as in a transaction.
    return new Promise((resolve) => {
      resolve(this.applyPublication(id, decide));
    });
  }

  private applyPublication(
    id: string,
    decide: (current: ItemRecord) => PublicationTransition | null,
  ): ItemRecord | null {
    const current = this.items.get(id);
    if (current === undefined) return null;
    const transition = decide(current);
    if (transition === null) return current;
    const updated: ItemRecord = {
      ...current,
      publicationStatus: transition.publicationStatus,
      submissionStatus: transition.submissionStatus,
      publishedAt: transition.publishedAt,
      updatedAt: this.now(),
    };
    this.items.set(id, updated);
    this.events.push({
      itemId: id,
      action: transition.action,
      actorId: transition.actorId,
      note: transition.note,
    });
    return updated;
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

  changeMedia(
    id: string,
    decide: (current: ItemRecord) => MediaChange,
  ): Promise<MediaChangeResult | null> {
    // An error thrown by `decide` becomes a rejection, as in a transaction.
    return new Promise((resolve) => {
      resolve(this.applyMedia(id, decide));
    });
  }

  private applyMedia(
    id: string,
    decide: (current: ItemRecord) => MediaChange,
  ): MediaChangeResult | null {
    const current = this.items.get(id);
    if (current === undefined) return null;
    const change = decide(current);
    const removed =
      current.media.find((media) => media.id === change.removeId) ?? null;
    const added: MediaRecord | null =
      change.add === undefined
        ? null
        : {
            ...change.add,
            position:
              removed?.position ?? (current.media.at(-1)?.position ?? -1) + 1,
            createdAt: this.now(),
          };
    if (removed === null && added === null) {
      return { item: current, added, removed };
    }
    const media = current.media
      .filter((existing) => existing.id !== removed?.id)
      .concat(added === null ? [] : [added])
      .sort((a, b) => a.position - b.position);
    const updated: ItemRecord = {
      ...current,
      media,
      claimStatus: 'unreviewed',
      updatedAt: this.now(),
    };
    this.items.set(id, updated);
    return { item: updated, added, removed };
  }

  /** Test helper standing in for the review and publication tasks. */
  patchRecord(id: string, fields: Partial<ItemRecord>): void {
    const current = this.items.get(id);
    if (current === undefined) throw new Error(`No item ${id}`);
    this.items.set(id, { ...current, ...fields });
  }
}
