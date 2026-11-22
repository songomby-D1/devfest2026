import type { CallerContext } from '../common/caller-context';
import { isReviewer } from '../common/caller-context';
import type { MediaKind } from '../media/media-format';
import type {
  ClaimReviewRecord,
  ClaimStatus,
  ClaimTarget,
  ItemKind,
  ItemRecord,
  MediaRecord,
  PublicationStatus,
  ReviewOutcome,
  SubmissionStatus,
} from './item';
import { currentReviews } from './review';

/** `ClaimReview` of the gateway contract (packages/shared `content.ts`). */
export interface ClaimReviewView {
  readonly target: ClaimTarget;
  readonly outcome: ReviewOutcome;
  readonly rationale: string;
  readonly evidence: readonly string[];
  readonly reviewerId: string;
  readonly reviewedAt: string;
}

export function toClaimReview(review: ClaimReviewRecord): ClaimReviewView {
  return {
    target: review.target,
    outcome: review.outcome,
    rationale: review.rationale,
    evidence: [...review.evidence],
    reviewerId: review.reviewerId,
    reviewedAt: review.reviewedAt.toISOString(),
  };
}

/** `MediaRef` of the gateway contract (packages/shared `content.ts`). */
export interface MediaRefView {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly bytes: number;
  /** Gateway-relative URL. */
  readonly url: string;
  readonly caption: string | null;
}

/** Gateway route that streams a media file (frozen contract `getMedia`). */
export function mediaUrl(itemId: string, mediaId: string): string {
  return `/api/items/${itemId}/media/${mediaId}`;
}

export function toMediaRef(itemId: string, media: MediaRecord): MediaRefView {
  return {
    id: media.id,
    kind: media.kind,
    mimeType: media.contentType,
    bytes: media.bytes,
    url: mediaUrl(itemId, media.id),
    caption: media.caption,
  };
}

/** The first image in display order; videos have no poster yet. */
function thumbnailUrlOf(item: ItemRecord): string | null {
  const image = item.media.find((media) => media.kind === 'image');
  return image === undefined ? null : mediaUrl(item.id, image.id);
}

/** `ItemDetail` of the gateway contract (packages/shared `content.ts`). */
export interface ItemDetailView {
  readonly id: string;
  readonly title: string;
  readonly kind: ItemKind;
  readonly creatorName: string | null;
  readonly origin: string | null;
  readonly period: string | null;
  readonly thumbnailUrl: string | null;
  readonly publicationStatus: PublicationStatus;
  readonly submissionStatus: SubmissionStatus;
  readonly claims: {
    readonly item: ClaimStatus;
    readonly description: ClaimStatus;
  };
  readonly updatedAt: string;
  readonly description: string;
  readonly creator: {
    readonly name: string | null;
    readonly community: string | null;
    readonly technique: string | null;
  };
  readonly rights: { readonly statement: string; readonly confirmed: boolean };
  readonly media: readonly MediaRefView[];
  /** Latest review per target, while that claim is reviewed. */
  readonly reviews: readonly ClaimReviewView[];
  readonly isOwner: boolean;
  readonly advisorySignals?: readonly never[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

/**
 * Maps a record to the contract shape. Everyone who may see the item sees
 * its claim statuses and current reviews: guests only ever see published
 * items, which matches settlement S5 (rationale to the owner and reviewers,
 * or to everyone once published). Advisory signals (CONTENT-05c) stay empty
 * and are only present for the owner and reviewers.
 */
export function toItemDetail(
  item: ItemRecord,
  caller: CallerContext,
): ItemDetailView {
  const isOwner = caller.userId !== null && caller.userId === item.ownerId;
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    creatorName: item.author.name,
    origin: item.origin,
    period: item.period,
    thumbnailUrl: thumbnailUrlOf(item),
    publicationStatus: item.publicationStatus,
    submissionStatus: item.submissionStatus,
    claims: {
      item: item.claimStatus,
      description: item.description.claimStatus,
    },
    updatedAt: item.updatedAt.toISOString(),
    description: item.description.text,
    creator: { ...item.author },
    rights: { ...item.rights },
    media: item.media.map((media) => toMediaRef(item.id, media)),
    reviews: currentReviews(item).map(toClaimReview),
    isOwner,
    ...(isOwner || isReviewer(caller) ? { advisorySignals: [] } : {}),
    createdAt: item.createdAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  };
}

/** `ItemSummary` of the gateway contract (packages/shared `content.ts`). */
export type ItemSummaryView = Pick<
  ItemDetailView,
  | 'id'
  | 'title'
  | 'kind'
  | 'creatorName'
  | 'origin'
  | 'period'
  | 'thumbnailUrl'
  | 'publicationStatus'
  | 'submissionStatus'
  | 'claims'
  | 'updatedAt'
>;

/** `ItemPage` of the gateway contract. */
export interface ItemPageView {
  readonly items: readonly ItemSummaryView[];
  readonly nextCursor: string | null;
}

/** `PublicationLookup` of the Gate 0 contract, for NFT and LiDAR. */
export interface PublicationLookupView {
  readonly contentId: string;
  readonly publicationStatus: PublicationStatus;
}

export function toItemSummary(item: ItemRecord): ItemSummaryView {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    creatorName: item.author.name,
    origin: item.origin,
    period: item.period,
    thumbnailUrl: thumbnailUrlOf(item),
    publicationStatus: item.publicationStatus,
    submissionStatus: item.submissionStatus,
    claims: {
      item: item.claimStatus,
      description: item.description.claimStatus,
    },
    updatedAt: item.updatedAt.toISOString(),
  };
}
