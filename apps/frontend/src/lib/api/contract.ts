// Frontend view of the gateway contract frozen at Gate 0, see
// docs/agents/parallel-workflow.md#contract-frozen-at-gate-0.
// Fields marked "provisional" are not in the frozen contract yet. They are the
// smallest additions the screens need and are raised as a [CONTRACT CHANGE]
// request; until it is agreed, only this module and the mock depend on them.

/** Opaque UUID string. The frontend never parses or builds one. */
export type ContentId = string;

export type PublicationStatus = 'draft' | 'published' | 'unpublished';

export type ClaimStatus = 'unreviewed' | 'verified' | 'uncertain';

/** Claim statuses are tracked separately for the item and its description. */
export interface ClaimReview {
  item: ClaimStatus;
  description: ClaimStatus;
}

export interface Item {
  id: ContentId;
  publicationStatus: PublicationStatus;
  claims: ClaimReview;
  /** Provisional. */
  title: string;
  /** Provisional. */
  description: string;
  /** Provisional: still image used for cards and as the 3D fallback. */
  imageUrl: string;
}

export interface ItemList {
  items: Item[];
}

/** Provisional: the item submission body for `POST /api/items`. */
export interface NewItem {
  title: string;
  description: string;
}

/** Provisional: the review body for `POST /api/items/:id/review`. */
export interface ReviewDecision {
  item: ClaimStatus;
  description: ClaimStatus;
}

export type Model3dStatus = 'ready' | 'processing' | 'missing';

export interface Model3dVariants {
  poster: string;
  glb1k: string;
  glb2k: string;
}

export interface Model3d {
  contentId: ContentId;
  status: Model3dStatus;
  /** Present only when `status` is `ready`. */
  variants?: Model3dVariants;
}

export type MintStatus = 'pending' | 'confirmed' | 'failed';

export interface MintResult {
  contentId: ContentId;
  status: MintStatus;
}

export interface Provenance {
  contentId: ContentId;
  mint: MintStatus | null;
  /** Provisional: public on-chain identifiers, present once confirmed. */
  tokenId?: string;
  transactionHash?: string;
}

/** Public error body. It never carries internal details. */
export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
}
