import { SUPPORTED_CHAINS } from '../blockchain/viem-blockchain';
import { failureReasonOf } from './mint-failure';
import type { MintRequestRecord, MintStatus } from './mint-request';

/** Frozen contract `MintRecord` (packages/shared, gateway OpenAPI). */
export interface MintView {
  readonly mintId: string;
  readonly contentId: string;
  readonly status: MintStatus;
  readonly network: {
    readonly name: string;
    readonly chainId: number;
    readonly contractAddress: string;
  } | null;
  readonly tokenId: string | null;
  readonly transactionHash: string | null;
  readonly explorerUrl: string | null;
  readonly failureReason: string | null;
  readonly requestedAt: string;
  readonly confirmedAt: string | null;
}

/** Frozen contract `Provenance`. */
export interface ProvenanceView {
  readonly contentId: string;
  readonly mint: MintView | null;
  readonly scope: string;
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

function explorerUrlOf(
  record: MintRequestRecord,
  explorerBaseUrl: string,
): string | null {
  const base = explorerBaseUrl.replace(/\/+$/, '');
  if (record.txHash !== null && record.status !== 'failed') {
    return `${base}/tx/${record.txHash}`;
  }
  if (record.tokenId !== null) {
    return `${base}/nft/${record.contractAddress}/${record.tokenId}`;
  }
  return null;
}

export function toMintView(
  record: MintRequestRecord,
  explorerBaseUrl: string,
): MintView {
  return {
    mintId: record.id,
    contentId: record.contentId,
    status: record.status,
    network: {
      name:
        SUPPORTED_CHAINS[record.chainId] ?? `Chain ${String(record.chainId)}`,
      chainId: record.chainId,
      contractAddress: record.contractAddress,
    },
    tokenId: record.status === 'confirmed' ? record.tokenId : null,
    transactionHash: record.txHash,
    explorerUrl: explorerUrlOf(record, explorerBaseUrl),
    failureReason:
      record.status === 'failed' ? failureReasonOf(record.failureCode) : null,
    requestedAt: record.createdAt.toISOString(),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
  };
}

export function toProvenanceView(
  contentId: string,
  record: MintRequestRecord | null,
  explorerBaseUrl: string,
): ProvenanceView {
  return {
    contentId,
    mint: record === null ? null : toMintView(record, explorerBaseUrl),
    scope: record === null ? NO_MINT_SCOPE : PROVENANCE_SCOPE,
  };
}
