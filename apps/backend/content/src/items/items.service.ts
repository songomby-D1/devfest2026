import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type CallerContext, isReviewer } from '../common/caller-context';
import { PublicError } from '../common/public-error';
import type {
  AuthorInfo,
  ItemChanges,
  ItemMetadata,
  ItemRecord,
  ItemRights,
} from './item';
import { ITEM_REPOSITORY, type ItemRepository } from './item-repository';
import type { CreateItemInput, UpdateItemInput } from './item-schemas';
import { type ItemDetailView, toItemDetail } from './item-view';

export const ITEM_PUBLISHED = 'ITEM_PUBLISHED';

/** Guests see published items only; drafts are visible to the owner and reviewers. */
export function canView(item: ItemRecord, caller: CallerContext): boolean {
  return (
    item.publicationStatus === 'published' ||
    (caller.userId !== null && caller.userId === item.ownerId) ||
    isReviewer(caller)
  );
}

function requireUser(caller: CallerContext): string {
  if (caller.userId === null) throw PublicError.unauthenticated();
  return caller.userId;
}

/** Keeps only the keys whose value differs from the current one. */
function changed<T extends object>(
  current: T,
  next: { readonly [K in keyof T]?: T[K] | undefined },
): Partial<T> {
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) =>
        value !== undefined && current[key as keyof T] !== value,
    ),
  ) as Partial<T>;
}

function isEmpty(value: object): boolean {
  return Object.keys(value).length === 0;
}

/**
 * Computes the real changes of a patch and which claims they reopen. Any
 * change to the item metadata or author information is a material change of
 * the item claims, and any change to the text reopens the description claims
 * (D18: re-review materially changed claims). Rights changes reopen neither.
 */
export function computeChanges(
  item: ItemRecord,
  patch: UpdateItemInput,
): ItemChanges {
  const metadata = changed<ItemMetadata>(item, {
    title: patch.title,
    kind: patch.kind,
    origin: patch.origin,
    period: patch.period,
  });
  const author = changed<AuthorInfo>(item.author, {
    name: patch.creatorName,
    community: patch.creatorCommunity,
    technique: patch.technique,
  });
  const rights = changed<ItemRights>(item.rights, {
    statement: patch.rightsStatement,
    confirmed: patch.rightsConfirmed,
  });
  const descriptionText =
    patch.description !== undefined &&
    patch.description !== item.description.text
      ? patch.description
      : undefined;
  return {
    ...(isEmpty(metadata) ? {} : { metadata }),
    ...(isEmpty(author) ? {} : { author }),
    ...(isEmpty(rights) ? {} : { rights }),
    ...(descriptionText === undefined ? {} : { descriptionText }),
    resetItemClaim: !isEmpty(metadata) || !isEmpty(author),
    resetDescriptionClaim: descriptionText !== undefined,
  };
}

function hasChanges(changes: ItemChanges): boolean {
  return (
    changes.metadata !== undefined ||
    changes.author !== undefined ||
    changes.rights !== undefined ||
    changes.descriptionText !== undefined
  );
}

function publishedConflict(): PublicError {
  return new PublicError(
    ITEM_PUBLISHED,
    'A published item cannot be edited',
    HttpStatus.CONFLICT,
  );
}

@Injectable()
export class ItemsService {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
  ) {}

  /** Any signed-in user submits an item; it starts as a draft in review (D13). */
  async create(
    caller: CallerContext,
    input: CreateItemInput,
  ): Promise<ItemDetailView> {
    const ownerId = requireUser(caller);
    const item = await this.items.create({
      ownerId,
      metadata: {
        title: input.title,
        kind: input.kind,
        origin: input.origin ?? null,
        period: input.period ?? null,
      },
      author: {
        name: input.creatorName ?? null,
        community: input.creatorCommunity ?? null,
        technique: input.technique ?? null,
      },
      rights: {
        statement: input.rightsStatement,
        confirmed: input.rightsConfirmed,
      },
      descriptionText: input.description,
    });
    return toItemDetail(item, caller);
  }

  /** Answers 404 for an item the caller may not see, so drafts are not disclosed. */
  async get(caller: CallerContext, id: string): Promise<ItemDetailView> {
    const item = await this.items.findById(id);
    if (item === null || !canView(item, caller)) throw PublicError.notFound();
    return toItemDetail(item, caller);
  }

  /** Only the owner edits, and only while the item is not published (D13). */
  async update(
    caller: CallerContext,
    id: string,
    patch: UpdateItemInput,
  ): Promise<ItemDetailView> {
    const userId = requireUser(caller);
    const item = await this.items.findById(id);
    if (item === null || !canView(item, caller)) throw PublicError.notFound();
    if (item.ownerId !== userId) {
      throw PublicError.forbidden('Only the submitter can edit this item');
    }
    if (item.publicationStatus === 'published') throw publishedConflict();

    const changes = computeChanges(item, patch);
    if (!hasChanges(changes)) return toItemDetail(item, caller);

    const updated = await this.items.updateUnpublished(id, changes);
    if (updated === null) throw publishedConflict();
    return toItemDetail(updated, caller);
  }
}
