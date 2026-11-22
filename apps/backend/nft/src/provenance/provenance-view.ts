import { MINT_FAILURES } from '../mint/mint-failure';
import type { MintRequestRecord } from '../mint/mint-request';
import {
  type MintView,
  NO_MINT_SCOPE,
  PROVENANCE_SCOPE,
  toMintView,
} from '../mint/mint-view';

/**
 * Public provenance body (NFT-05). It is the frozen contract `Provenance`
 * (packages/shared, gateway OpenAPI): `{ contentId, mint, scope }`, where
 * `mint` carries exactly the `MintRecord` fields NFT-04 returns, plus
 * optional display fields. The platform contract allows added optional
 * fields without a contract change.
 */
export interface ProvenanceView {
  readonly contentId: string;
  /** `null` when no mint was ever requested for the item. */
  readonly mint: ProvenanceMintView | null;
  readonly scope: string;
}

export interface ExplorerLinks {
  readonly transaction: string | null;
  readonly token: string | null;
}

/** What the chain says about a confirmed record. */
export type VerificationState =
  /** The token exists, and its master hash and token URI match the record. */
  | 'verified'
  /** The chain answered and disagrees with the record. */
  | 'mismatch'
  /** The chain could not be read; the record is shown as stored. */
  | 'unverifiable';

export interface OnChainView {
  readonly title: string;
  readonly category: string;
  readonly mintedAt: string;
  readonly masterHash: string;
  readonly tokenUri: string | null;
  /** `ownerOf(tokenId)`: the gallery wallet (custodial model, S2). */
  readonly owner: string | null;
}

export interface VerificationView {
  readonly state: VerificationState;
  /** `verifyFixity(tokenId, masterHash)`, `null` when unverifiable. */
  readonly fixity: boolean | null;
  /** On-chain token data, `null` when unverifiable or the token is missing. */
  readonly onChain: OnChainView | null;
  readonly checkedAt: string;
}

/** Optional NFT-05 additions to the frozen `MintRecord`. */
export interface ProvenanceMintView extends MintView {
  /** Allowlisted public failure code, when `failed`. */
  readonly failureCode?: string;
  /** When pending or confirmed. */
  readonly explorer?: ExplorerLinks;
  /** `ipfs://<metadata CID>`, when confirmed. */
  readonly tokenUri?: string | null;
  /** HTTPS gateway URL of the metadata JSON, when confirmed. */
  readonly metadataUrl?: string | null;
  readonly metadataCid?: string | null;
  /** `0x` + sha256 of the master file, when confirmed. */
  readonly masterHash?: string | null;
  /** Time the confirmation was recorded, when confirmed. */
  readonly mintedAt?: string | null;
  /** When confirmed. */
  readonly verification?: VerificationView;
}

export interface ViewOptions {
  readonly explorerBaseUrl: string;
  readonly ipfsGatewayUrl: string;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TOKEN_ID = /^[0-9]{1,78}$/;
const CID = /^[A-Za-z0-9]{10,128}$/;
const IPFS_URI = /^ipfs:\/\/([A-Za-z0-9]{10,128})$/;

/** Keeps a stored value only when it has the expected public shape. */
function shaped(value: string | null, pattern: RegExp): string | null {
  return value !== null && pattern.test(value) ? value : null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** The stored code when it is a known public one, otherwise `UNKNOWN`. */
export function publicFailureCode(code: string | null): string {
  return code !== null && Object.hasOwn(MINT_FAILURES, code) ? code : 'UNKNOWN';
}

/** `ipfs://<cid>` → `<gateway>/<cid>`, or `null` for any other value. */
export function gatewayUrlOf(
  tokenUri: string | null,
  ipfsGatewayUrl: string,
): string | null {
  const cid = tokenUri === null ? undefined : IPFS_URI.exec(tokenUri)?.[1];
  return cid === undefined ? null : `${trimSlash(ipfsGatewayUrl)}/${cid}`;
}

/**
 * Builds the public mint view: NFT-04's `MintRecord` unchanged, plus
 * - `failed`: the allowlisted `failureCode`;
 * - `pending`: explorer links once the transaction is sent;
 * - `confirmed`: explorer links, token URI and its gateway URL, metadata
 *   CID, master hash, `mintedAt` and the verification block.
 * The requester, idempotency key, attempts and request ID never leave.
 */
export function toProvenanceMintView(
  record: MintRequestRecord,
  options: ViewOptions,
  verification: VerificationView | undefined,
): ProvenanceMintView {
  const base = toMintView(record, options.explorerBaseUrl);
  if (record.status === 'failed') {
    return { ...base, failureCode: publicFailureCode(record.failureCode) };
  }

  const explorer = trimSlash(options.explorerBaseUrl);
  const txHash = shaped(record.txHash, TX_HASH);
  const transaction = txHash === null ? null : `${explorer}/tx/${txHash}`;
  if (record.status === 'pending') {
    return { ...base, explorer: { transaction, token: null } };
  }

  const tokenId = shaped(record.tokenId, TOKEN_ID);
  const contract = shaped(record.contractAddress, ADDRESS);
  const token =
    tokenId === null || contract === null
      ? null
      : `${explorer}/nft/${contract}/${tokenId}`;
  const tokenUri = shaped(record.tokenUri, IPFS_URI);
  return {
    ...base,
    explorer: { transaction, token },
    tokenUri,
    metadataUrl: gatewayUrlOf(tokenUri, options.ipfsGatewayUrl),
    metadataCid: shaped(record.metadataCid, CID),
    masterHash: shaped(record.masterHash, TX_HASH)?.toLowerCase() ?? null,
    mintedAt: base.confirmedAt,
    ...(verification === undefined ? {} : { verification }),
  };
}

export function toProvenanceView(
  contentId: string,
  mint: ProvenanceMintView | null,
): ProvenanceView {
  return {
    contentId,
    mint,
    scope: mint === null ? NO_MINT_SCOPE : PROVENANCE_SCOPE,
  };
}

/** Confirmed and checked: immutable on-chain, a short public cache is safe. */
export const CONFIRMED_CACHE = 'public, max-age=60';
/** Confirmed but the chain could not check it: retry the check soon. */
export const UNVERIFIED_CACHE = 'public, max-age=15';
/** No mint, pending or failed: the status may change on the next poll. */
export const NO_STORE = 'no-store';

export function cacheControlOf(view: ProvenanceView): string {
  if (view.mint?.status !== 'confirmed') return NO_STORE;
  return view.mint.verification?.state === 'unverifiable'
    ? UNVERIFIED_CACHE
    : CONFIRMED_CACHE;
}
