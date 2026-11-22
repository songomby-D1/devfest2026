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

// 3D and provenance types follow packages/shared/src/provenance.ts. The NFT
// service adds optional NFT-05 display fields to `MintRecord` on the
// provenance route (apps/backend/nft/src/provenance/provenance-view.ts); the
// platform contract allows added optional fields.

export type Model3dStatus = 'ready' | 'processing' | 'missing';

export interface Model3dVariants {
  /** Gateway-relative URLs. */
  poster: string;
  glb1k: string;
  glb2k: string;
}

/** `Model3dDescriptor` in packages/shared. */
export interface Model3d {
  contentId: ContentId;
  status: Model3dStatus;
  /** `null` unless `status` is `ready`. */
  variants: Model3dVariants | null;
}

export type MintStatus = 'pending' | 'confirmed' | 'failed';

export interface MintNetwork {
  name: string;
  chainId: number;
  contractAddress: string;
}

/** Frozen `MintRecord`: the body of `POST /api/items/:id/mint`. */
export interface MintRecord {
  mintId: string;
  contentId: ContentId;
  status: MintStatus;
  network: MintNetwork | null;
  tokenId: string | null;
  transactionHash: string | null;
  explorerUrl: string | null;
  /** Safe, displayable reason (in English) when `status` is `failed`. */
  failureReason: string | null;
  requestedAt: string;
  confirmedAt: string | null;
}

/** What `POST /api/items/:id/mint` answered: 202 creates, 200 replays a key. */
export interface MintResult {
  /** `true` on 202 (new pending mint), `false` on 200 (replayed key). */
  created: boolean;
  mint: MintRecord;
}

/** Allowlisted public failure codes of the NFT service. */
export type MintFailureCode =
  | 'CONTRACT_REVERTED'
  | 'INSUFFICIENT_FUNDS'
  | 'CHAIN_UNAVAILABLE'
  | 'METADATA_UNAVAILABLE'
  | 'INVALID_METADATA'
  | 'UNKNOWN';

export interface ExplorerLinks {
  transaction: string | null;
  token: string | null;
}

/**
 * `verified`: the token exists and its master hash and token URI match the
 * record. `mismatch`: the chain disagrees. `unverifiable`: the chain could not
 * be read, the record is shown as stored.
 */
export type VerificationState = 'verified' | 'mismatch' | 'unverifiable';

export interface OnChainRecord {
  title: string;
  category: string;
  mintedAt: string;
  masterHash: string;
  tokenUri: string | null;
  /** The gallery wallet: certificates are custodial. */
  owner: string | null;
}

export interface MintVerification {
  state: VerificationState;
  /** On-chain fixity check, `null` when unverifiable. */
  fixity: boolean | null;
  onChain: OnChainRecord | null;
  checkedAt: string;
}

/** `MintRecord` plus the optional NFT-05 display fields of the provenance route. */
export interface ProvenanceMint extends MintRecord {
  /** When `failed`. Codes outside the known list may appear. */
  failureCode?: MintFailureCode | (string & {});
  /** When pending or confirmed. */
  explorer?: ExplorerLinks;
  /** `ipfs://<metadata CID>`, when confirmed. */
  tokenUri?: string | null;
  /** HTTPS gateway URL of the metadata JSON, when confirmed. */
  metadataUrl?: string | null;
  metadataCid?: string | null;
  /** `0x` + sha256 of the master file, when confirmed. */
  masterHash?: string | null;
  mintedAt?: string | null;
  /** When confirmed. */
  verification?: MintVerification;
}

export interface Provenance {
  contentId: ContentId;
  /** `null` when no mint was ever requested. */
  mint: ProvenanceMint | null;
  /** States what the record establishes and what it does not (English). */
  scope: string;
}

/** Public error body. It never carries internal details. */
export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
}
