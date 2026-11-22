import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type CallerContext, isReviewer } from '../common/caller-context';
import { PublicError } from '../common/public-error';
import type { ServiceCaller } from '../config/app-config';
import type {
  AuthorInfo,
  ItemChanges,
  ItemListFilter,
  ItemMetadata,
  ItemRecord,
  ItemRights,
  PublicationTransition,
} from './item';
import {
  type ItemListScope,
  type ListItemsQuery,
  decodeCursor,
  encodeCursor,
} from './item-list';
import { ITEM_REPOSITORY, type ItemRepository } from './item-repository';
import type {
  CreateItemInput,
  DecisionInput,
  UnpublishInput,
  UpdateItemInput,
} from './item-schemas';
import {
  type ItemDetailView,
  type ItemPageView,
  type PublicationLookupView,
  toItemDetail,
  toItemSummary,
} from './item-view';
import { planPublish, planUnpublish } from './publication';

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

/** Services allowed to look up a publication status (platform contract). */
export const PUBLICATION_LOOKUP_CALLERS: readonly ServiceCaller[] = [
  'nft',
  'lidar',
];

export const DECISION_NOT_AVAILABLE = 'DECISION_NOT_AVAILABLE';

/** Publication changes need the reviewer permission (D13, D18). */
function requireReviewer(caller: CallerContext): string {
  const userId = requireUser(caller);
  if (!isReviewer(caller)) {
    throw PublicError.forbidden('Only a reviewer can change the publication');
  }
  return userId;
}

/**
 * Builds the repository filter of a scope. `public` lists published items
 * for everyone; `mine` lists every item of the signed-in caller; `review`
 * lists the submissions in review, oldest first, without the reviewer's own.
 */
function scopeFilter(
  caller: CallerContext,
  scope: ItemListScope,
): Pick<
  ItemListFilter,
  | 'publicationStatus'
  | 'submissionStatus'
  | 'ownerId'
  | 'excludeOwnerId'
  | 'order'
> {
  switch (scope) {
    case 'public':
      return { publicationStatus: 'published', order: 'newest_first' };
    case 'mine':
      return { ownerId: requireUser(caller), order: 'newest_first' };
    case 'review': {
      const userId = requireUser(caller);
      if (!isReviewer(caller)) {
        throw PublicError.forbidden(
          'Only a reviewer can list the review queue',
        );
      }
      return {
        submissionStatus: 'in_review',
        excludeOwnerId: userId,
        order: 'oldest_first',
      };
    }
  }
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

  /** One page of items in the requested scope (Gate 0 `listItems`). */
  async list(
    caller: CallerContext,
    query: ListItemsQuery,
  ): Promise<ItemPageView> {
    const filter = scopeFilter(caller, query.scope);
    const after =
      query.cursor === undefined
        ? undefined
        : decodeCursor(query.scope, query.cursor);
    // One extra row tells whether another page follows.
    const rows = await this.items.list({
      ...filter,
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.q === undefined ? {} : { text: query.q }),
      ...(after === undefined ? {} : { after }),
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(toItemSummary),
      nextCursor:
        rows.length > query.limit && last !== undefined
          ? encodeCursor(query.scope, last)
          : null,
    };
  }

  /**
   * Gate 0 `POST /api/items/:id/decision`. Only `publish` is available until
   * the review workflow (CONTENT-04) adds `return` and `reject`.
   */
  async decide(
    caller: CallerContext,
    id: string,
    input: DecisionInput,
  ): Promise<ItemDetailView> {
    requireReviewer(caller);
    if (input.decision !== 'publish') {
      throw new PublicError(
        DECISION_NOT_AVAILABLE,
        'This decision is not available yet',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.publish(caller, id, input.note);
  }

  /**
   * Publishes a draft or unpublished item. A reviewer other than the
   * submitter decides, after both claims are reviewed and the rights are
   * confirmed (D13, D18). CONTENT-04 calls this from the decision route, or
   * after the last review if settlement S3 is confirmed.
   */
  async publish(
    caller: CallerContext,
    id: string,
    note: string,
  ): Promise<ItemDetailView> {
    const reviewerId = requireReviewer(caller);
    return this.transition(caller, id, (item) => {
      if (item.ownerId === reviewerId) {
        throw PublicError.forbidden('A reviewer cannot publish their own item');
      }
      return planPublish(item, reviewerId, note, new Date());
    });
  }

  /** Takes a published item out of public browsing. Reviewer only (D13). */
  async unpublish(
    caller: CallerContext,
    id: string,
    input: UnpublishInput,
  ): Promise<ItemDetailView> {
    const reviewerId = requireReviewer(caller);
    return this.transition(caller, id, (item) =>
      planUnpublish(item, reviewerId, input.note),
    );
  }

  /**
   * Publication status for NFT and LiDAR (D01: the ContentId and publication
   * status are the handoffs from Content). Other callers, including the
   * gateway that forwards `/api/items...`, get `404` so the route stays off
   * the public surface and never reveals a draft.
   */
  async publication(
    service: ServiceCaller,
    id: string,
  ): Promise<PublicationLookupView> {
    if (!PUBLICATION_LOOKUP_CALLERS.includes(service)) {
      throw PublicError.notFound();
    }
    const item = await this.items.findById(id);
    if (item === null) throw PublicError.notFound();
    return { contentId: item.id, publicationStatus: item.publicationStatus };
  }

  private async transition(
    caller: CallerContext,
    id: string,
    decide: (item: ItemRecord) => PublicationTransition | null,
  ): Promise<ItemDetailView> {
    const item = await this.items.changePublication(id, decide);
    if (item === null) throw PublicError.notFound();
    return toItemDetail(item, caller);
  }
}
