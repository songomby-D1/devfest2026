/** Opaque UUID created by Content. Other services store and forward it without parsing it. */
export type ContentId = string;

export type PublicationStatus = 'draft' | 'published' | 'unpublished';

export type SubmissionStatus =
  'in_review' | 'returned' | 'rejected' | 'accepted';

/** Tracked separately for the item claims and the description claims (D18). */
export type ClaimStatus = 'unreviewed' | 'verified' | 'uncertain';

export type ClaimTarget = 'item' | 'description';

export type ReviewOutcome = Exclude<ClaimStatus, 'unreviewed'>;

export type ItemKind =
  'painting' | 'sculpture' | 'photograph' | 'textile' | 'object' | 'other';

export type MediaKind = 'image' | 'video';

export interface ClaimStatuses {
  readonly item: ClaimStatus;
  readonly description: ClaimStatus;
}

export interface MediaRef {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly bytes: number;
  /** Gateway-relative URL, for example `/api/items/{id}/media/{mediaId}`. */
  readonly url: string;
  readonly caption: string | null;
}

export interface ClaimReview {
  readonly target: ClaimTarget;
  readonly outcome: ReviewOutcome;
  readonly rationale: string;
  readonly evidence: readonly string[];
  readonly reviewerId: string;
  readonly reviewedAt: string;
}

export type AdvisorySignalKind = 'ai_generated' | 'description_mismatch';

/** Advisory only: never changes a claim status. Visible to reviewers and the owner. */
export interface AdvisorySignal {
  readonly kind: AdvisorySignalKind;
  /** Between 0 and 1. Higher means a stronger signal. */
  readonly score: number;
  readonly source: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface ItemSummary {
  readonly id: ContentId;
  readonly title: string;
  readonly kind: ItemKind;
  readonly creatorName: string | null;
  readonly origin: string | null;
  readonly period: string | null;
  readonly thumbnailUrl: string | null;
  readonly publicationStatus: PublicationStatus;
  readonly submissionStatus: SubmissionStatus;
  readonly claims: ClaimStatuses;
  readonly updatedAt: string;
}

export interface CreatorDetails {
  readonly name: string | null;
  readonly community: string | null;
  readonly technique: string | null;
}

export interface RightsDetails {
  readonly statement: string;
  readonly confirmed: boolean;
}

export interface ItemDetail extends ItemSummary {
  readonly description: string;
  readonly creator: CreatorDetails;
  readonly rights: RightsDetails;
  readonly media: readonly MediaRef[];
  /** Latest review per target. */
  readonly reviews: readonly ClaimReview[];
  readonly isOwner: boolean;
  /** Present only for reviewers and the owner. */
  readonly advisorySignals?: readonly AdvisorySignal[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

export type ItemListScope = 'public' | 'mine' | 'review';

export interface ItemListQuery {
  readonly scope?: ItemListScope;
  readonly kind?: ItemKind;
  readonly q?: string;
  readonly cursor?: string;
  /** 1 to 50, default 20. */
  readonly limit?: number;
}

export interface ItemPage {
  readonly items: readonly ItemSummary[];
  readonly nextCursor: string | null;
}

export interface CreateItemRequest {
  readonly title: string;
  readonly kind: ItemKind;
  readonly description: string;
  readonly creatorName?: string | null;
  readonly creatorCommunity?: string | null;
  readonly technique?: string | null;
  readonly origin?: string | null;
  readonly period?: string | null;
  readonly rightsStatement: string;
  /** The contributor confirms the right to publish the media and record. */
  readonly rightsConfirmed: boolean;
}

export interface ReviewRequest {
  readonly target: ClaimTarget;
  readonly outcome: ReviewOutcome;
  readonly rationale: string;
  readonly evidence: readonly string[];
}

export type DecisionKind = 'publish' | 'return' | 'reject';

export interface DecisionRequest {
  readonly decision: DecisionKind;
  readonly note: string;
}

/** Service-to-service publication lookup used by NFT and LiDAR. */
export interface PublicationLookup {
  readonly contentId: ContentId;
  readonly publicationStatus: PublicationStatus;
}
