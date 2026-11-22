import type { MintStatus, ProvenanceMintRecord } from './provenance.ports';

/**
 * Public provenance body. It is the frozen contract `Provenance`
 * (packages/shared, gateway OpenAPI): `{ contentId, mint, scope }` with the
 * `MintRecord` fields. NFT-05 adds optional fields only, which the platform
 * contract allows without a contract change.
 */
export interface ProvenanceView {
  readonly contentId: string;
  /** `null` when no mint was ever requested for the item. */
  readonly mint: ProvenanceMintView | null;
  readonly scope: string;
}

export interface NetworkView {
  readonly name: string;
  readonly chainId: number;
  readonly contractAddress: string;
}

export interface ExplorerLinks {
  readonly transaction: string | null;
  readonly token: string | null;
}

/** What the chain says about a confirmed record. */
export type VerificationState =
  /** The token exists, its master hash and token URI match the record. */
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
}

export interface VerificationView {
  readonly state: VerificationState;
  /** `verifyFixity(tokenId, masterHash)`, `null` when unverifiable. */
  readonly fixity: boolean | null;
  /** On-chain token data, `null` when unverifiable or the token is missing. */
  readonly onChain: OnChainView | null;
  readonly checkedAt: string;
}

export interface ProvenanceMintView {
  // Frozen contract `MintRecord`.
  readonly mintId: string;
  readonly contentId: string;
  readonly status: MintStatus;
  readonly network: NetworkView | null;
  readonly tokenId: string | null;
  readonly transactionHash: string | null;
  /** Transaction link, else token link (contract `explorerUrl`). */
  readonly explorerUrl: string | null;
  readonly failureReason: string | null;
  readonly requestedAt: string;
  readonly confirmedAt: string | null;
  // Optional NFT-05 additions.
  /** Allowlisted public failure code when `failed`, otherwise `null`. */
  readonly failureCode?: string | null;
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
  /** Present when confirmed. */
  readonly verification?: VerificationView;
}

/** What a record establishes and what it does not (MVP section C). */
export const PROVENANCE_SCOPE =
  'This certificate records that the LOVA gallery registered this published ' +
  'item on a public test blockchain, with a fingerprint of its master file. ' +
  'It does not prove physical authenticity, authorship or ownership of the ' +
  'work or of its rights.';

export const NO_MINT_SCOPE =
  'No certificate has been requested for this item. Its record in LOVA is ' +
  'unchanged; a certificate would only record a registration date.';

/** Public failure codes and their safe sentences (same codes as NFT-04). */
export const PUBLIC_FAILURES: Readonly<Record<string, string>> = {
  CONTRACT_REVERTED: 'The certificate contract refused this mint.',
  INSUFFICIENT_FUNDS:
    'The gallery cannot pay the network fee right now. Try again later.',
  CHAIN_UNAVAILABLE:
    'The blockchain network could not be reached. Try again later.',
  METADATA_UNAVAILABLE:
    'The certificate details could not be published. Try again later.',
  INVALID_METADATA: 'This item cannot be written into a certificate.',
  UNKNOWN: 'The certificate could not be created. Try again later.',
};

const CHAIN_NAMES: Readonly<Record<number, string>> = {
  43113: 'Avalanche Fuji',
  31337: 'Hardhat local',
};

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TOKEN_ID = /^[0-9]{1,78}$/;
const CID = /^[A-Za-z0-9]{10,128}$/;
const IPFS_URI = /^ipfs:\/\/([A-Za-z0-9]{10,128})$/;

/** Keeps a stored value only when it has the expected public shape. */
function shaped(value: string | null, pattern: RegExp): string | null {
  return value !== null && pattern.test(value) ? value : null;
}

export function publicFailureCode(code: string | null): string {
  return code !== null && Object.hasOwn(PUBLIC_FAILURES, code)
    ? code
    : 'UNKNOWN';
}

export interface ViewOptions {
  readonly explorerBaseUrl: string;
  readonly ipfsGatewayUrl: string;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function networkOf(record: ProvenanceMintRecord): NetworkView | null {
  const contractAddress = shaped(record.contractAddress, ADDRESS);
  if (contractAddress === null) return null;
  return {
    name: CHAIN_NAMES[record.chainId] ?? `Chain ${String(record.chainId)}`,
    chainId: record.chainId,
    contractAddress,
  };
}

/** `ipfs://<cid>` → `<gateway>/<cid>`, or `null` for any other value. */
export function gatewayUrlOf(
  tokenUri: string | null,
  ipfsGatewayUrl: string,
): string | null {
  const cid = tokenUri === null ? undefined : IPFS_URI.exec(tokenUri)?.[1];
  return cid === undefined ? null : `${trimSlash(ipfsGatewayUrl)}/${cid}`;
}

function base(
  record: ProvenanceMintRecord,
  network: NetworkView | null,
): ProvenanceMintView {
  return {
    mintId: record.id,
    contentId: record.contentId,
    status: record.status,
    network,
    tokenId: null,
    transactionHash: null,
    explorerUrl: null,
    failureReason: null,
    requestedAt: record.createdAt.toISOString(),
    confirmedAt: null,
  };
}

/**
 * Builds the public mint view. Only public fields leave the service: no
 * requester, idempotency key, attempts or internal failure detail.
 *
 * - `pending`: status, network and, once sent, the transaction and its link.
 * - `failed`: status, an allowlisted failure code and its safe sentence.
 * - `confirmed`: every chain reference, links and the verification block.
 */
export function toMintView(
  record: ProvenanceMintRecord,
  options: ViewOptions,
  verification: VerificationView | undefined,
): ProvenanceMintView {
  const network = networkOf(record);
  const explorer = trimSlash(options.explorerBaseUrl);
  const txHash = shaped(record.txHash, TX_HASH);
  const txLink = txHash === null ? null : `${explorer}/tx/${txHash}`;

  if (record.status === 'failed') {
    const failureCode = publicFailureCode(record.failureCode);
    return {
      ...base(record, network),
      failureCode,
      failureReason: PUBLIC_FAILURES[failureCode] ?? null,
    };
  }

  if (record.status === 'pending') {
    return {
      ...base(record, network),
      transactionHash: txHash,
      explorerUrl: txLink,
      explorer: { transaction: txLink, token: null },
    };
  }

  const tokenId = shaped(record.tokenId, TOKEN_ID);
  const tokenLink =
    tokenId === null || network === null
      ? null
      : `${explorer}/nft/${network.contractAddress}/${tokenId}`;
  const tokenUri = shaped(record.tokenUri, IPFS_URI);
  const confirmedAt = record.confirmedAt?.toISOString() ?? null;
  return {
    ...base(record, network),
    tokenId,
    transactionHash: txHash,
    explorerUrl: txLink ?? tokenLink,
    confirmedAt,
    explorer: { transaction: txLink, token: tokenLink },
    tokenUri,
    metadataUrl: gatewayUrlOf(tokenUri, options.ipfsGatewayUrl),
    metadataCid: shaped(record.metadataCid, CID),
    masterHash: shaped(record.masterHash, TX_HASH)?.toLowerCase() ?? null,
    mintedAt: confirmedAt,
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
