/** Persistence-independent item types (CONTENT-01). */

export const ITEM_KINDS = [
  'painting',
  'sculpture',
  'photograph',
  'textile',
  'object',
  'other',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type PublicationStatus = 'draft' | 'published' | 'unpublished';
export type SubmissionStatus =
  'in_review' | 'returned' | 'rejected' | 'accepted';
export type ClaimStatus = 'unreviewed' | 'verified' | 'uncertain';

/** Free-text author information (S7). Never an Auth account. */
export interface AuthorInfo {
  readonly name: string | null;
  readonly community: string | null;
  readonly technique: string | null;
}

/** Item fields whose change is a material change of the item claims (D18). */
export interface ItemMetadata {
  readonly title: string;
  readonly kind: ItemKind;
  readonly origin: string | null;
  readonly period: string | null;
}

export interface ItemRights {
  readonly statement: string;
  readonly confirmed: boolean;
}

export interface ItemRecord extends ItemMetadata {
  /** ContentId: opaque UUID shared with NFT and LiDAR (D01). */
  readonly id: string;
  readonly ownerId: string;
  readonly author: AuthorInfo;
  readonly rights: ItemRights;
  readonly description: {
    readonly text: string;
    readonly claimStatus: ClaimStatus;
  };
  readonly publicationStatus: PublicationStatus;
  readonly submissionStatus: SubmissionStatus;
  /** Status of the identity or source claims about the item. */
  readonly claimStatus: ClaimStatus;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data needed to create an item; statuses take their defaults. */
export interface NewItem {
  readonly ownerId: string;
  readonly metadata: ItemMetadata;
  readonly author: AuthorInfo;
  readonly rights: ItemRights;
  readonly descriptionText: string;
}

/** A partial update computed by the service, already reduced to real changes. */
export interface ItemChanges {
  readonly metadata?: Partial<ItemMetadata>;
  readonly author?: Partial<AuthorInfo>;
  readonly rights?: Partial<ItemRights>;
  readonly descriptionText?: string;
  /** Resets the item claim status to `unreviewed` (D18 re-review). */
  readonly resetItemClaim: boolean;
  /** Resets the description claim status to `unreviewed` (D18 re-review). */
  readonly resetDescriptionClaim: boolean;
}

/** Publication actions recorded in the publication history (CONTENT-02). */
export const PUBLICATION_ACTIONS = ['publish', 'unpublish'] as const;
export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number];

/**
 * A publication change decided by the service on the locked current record.
 * The repository applies the target statuses and records the event together.
 */
export interface PublicationTransition {
  readonly action: PublicationAction;
  /** Auth account ID of the reviewer who made the change. */
  readonly actorId: string;
  readonly note: string;
  readonly publicationStatus: PublicationStatus;
  readonly submissionStatus: SubmissionStatus;
  readonly publishedAt: Date | null;
}

/** Position of the last item of a page, for keyset pagination. */
export interface ItemPosition {
  readonly createdAt: Date;
  readonly id: string;
}

/**
 * A listing filter built by the service from the scope and the caller. The
 * order is on the immutable (`createdAt`, `id`) pair, so pages are stable.
 */
export interface ItemListFilter {
  readonly publicationStatus?: PublicationStatus;
  readonly submissionStatus?: SubmissionStatus;
  readonly ownerId?: string;
  /** Leaves out one owner's items, such as a reviewer's own submissions. */
  readonly excludeOwnerId?: string;
  readonly kind?: ItemKind;
  /** Case-insensitive substring of the title or the author name. */
  readonly text?: string;
  readonly order: 'newest_first' | 'oldest_first';
  /** Returns only items strictly after this position in the order. */
  readonly after?: ItemPosition;
  readonly limit: number;
}
