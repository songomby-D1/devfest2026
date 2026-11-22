/**
 * Read ports of the provenance display (NFT-05).
 *
 * NFT-04 (#62) owns the mint records (Prisma `mint_requests`) and the chain
 * client (viem). This module only reads them, through the two ports below.
 * Until the wiring follow-up binds the real implementations, the module uses
 * the clearly named fallbacks of `provenance.fakes.ts`; docs/provenance.md
 * lists exactly what the follow-up binds.
 */

/** Frozen contract `MintStatus`. */
export const MINT_STATUSES = ['pending', 'confirmed', 'failed'] as const;
export type MintStatus = (typeof MINT_STATUSES)[number];

/**
 * The fields of a `mint_requests` row that provenance reads. NFT-04's
 * `MintRequestRecord` is a superset, so its repository satisfies
 * `MintRecordReader` without an adapter.
 */
export interface ProvenanceMintRecord {
  /** Mint request ID, shown as `mintId`. */
  readonly id: string;
  readonly contentId: string;
  readonly status: MintStatus;
  readonly chainId: number;
  readonly contractAddress: string;
  /** `ipfs://<metadata CID>`, saved before the transaction is sent. */
  readonly tokenUri: string | null;
  readonly metadataCid: string | null;
  /** `0x` + sha256 of the master file. */
  readonly masterHash: string | null;
  readonly txHash: string | null;
  /** uint256 as a decimal string. */
  readonly tokenId: string | null;
  /** Internal failure code; only an allowlisted code is ever shown. */
  readonly failureCode: string | null;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
}

/** Reads mint records. Implemented by NFT-04's `MintRepository`. */
export interface MintRecordReader {
  /**
   * The pending or confirmed request of an item, otherwise its latest failed
   * one, otherwise `null`. `contentId` is a lowercase UUID.
   */
  findLatestForContent(contentId: string): Promise<ProvenanceMintRecord | null>;
}

export const MINT_RECORD_READER = Symbol('MINT_RECORD_READER');

/** `PreservingArt.Artwork`, decoded. */
export interface OnChainArtwork {
  /** `block.timestamp` of the mint. */
  readonly mintedAt: Date;
  /** Contract `enum Category`: `Painting`, `Sculpture` or `Craft`. */
  readonly category: string;
  /** `0x` + 64 hex chars. */
  readonly masterHash: string;
  readonly title: string;
}

/**
 * Public, read-only views of the PreservingArt contract. Every method
 * rejects when the chain cannot be read (RPC down, timeout); provenance then
 * reports the record as `unverifiable` instead of failing.
 */
export interface ChainProvenanceReader {
  /** `getArtwork(tokenId)`, or `null` when the token does not exist. */
  getArtwork(tokenId: string): Promise<OnChainArtwork | null>;
  /** `verifyFixity(tokenId, hash)`; `false` when the token does not exist. */
  verifyFixity(tokenId: string, masterHash: string): Promise<boolean>;
  /** `tokenURI(tokenId)`, or `null` when the token does not exist. */
  tokenUri(tokenId: string): Promise<string | null>;
}

export const CHAIN_PROVENANCE_READER = Symbol('CHAIN_PROVENANCE_READER');
