// Frontend view of the gateway contract frozen at Gate 0, see
// docs/agents/parallel-workflow.md#contract-frozen-at-gate-0.
// Fields marked "provisional" are not in the frozen contract yet. They are the
// smallest additions the screens need and are raised as a [CONTRACT CHANGE]
// request; until it is agreed, only this module and the mock depend on them.

// Content and identity shapes come straight from packages/shared, the source
// of truth of the Gate 0 contract, as type-only imports.
import type { ContentId, PublicError } from '@devfest2026/shared';

export type {
  AdvisorySignal,
  AdvisorySignalKind,
  ClaimReview,
  ClaimStatus,
  ClaimStatuses,
  ClaimTarget,
  ContentId,
  CreateItemRequest,
  CreatorDetails,
  DecisionKind,
  DecisionRequest,
  ItemDetail,
  ItemKind,
  ItemListQuery,
  ItemListScope,
  ItemPage,
  ItemSummary,
  LoginRequest,
  MediaKind,
  MediaRef,
  Me,
  Permission,
  PublicationStatus,
  RegisterRequest,
  RegisterResponse,
  ReviewOutcome,
  ReviewRequest,
  RightsDetails,
  SubmissionStatus,
  ValidationIssue,
} from '@devfest2026/shared';

/** Options of a media upload. The caption is at most 300 characters. */
export interface UploadOptions {
  caption?: string | undefined;
  /** Called with the fraction sent, from 0 to 1. */
  onProgress?: ((fraction: number) => void) | undefined;
  signal?: AbortSignal | undefined;
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
export type ApiErrorBody = PublicError;
