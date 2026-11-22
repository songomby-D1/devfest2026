/** Frozen contract `MintStatus`. */
export const MINT_STATUSES = ['pending', 'confirmed', 'failed'] as const;
export type MintStatus = (typeof MINT_STATUSES)[number];

/** A row of `mint_requests` (prisma/schema.prisma). */
export interface MintRequestRecord {
  readonly id: string;
  readonly contentId: string;
  readonly requesterId: string;
  readonly idempotencyKey: string;
  readonly status: MintStatus;
  readonly attempts: number;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly tokenUri: string | null;
  readonly metadataCid: string | null;
  readonly masterHash: string | null;
  readonly txHash: string | null;
  readonly tokenId: string | null;
  /** Final code when `failed`; last transient code while `pending`. */
  readonly failureCode: string | null;
  readonly requestId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date | null;
  readonly confirmedAt: Date | null;
  readonly failedAt: Date | null;
}

export interface NewMintRequest {
  readonly contentId: string;
  readonly requesterId: string;
  readonly idempotencyKey: string;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly requestId: string;
}

/** Fields the mint worker may change on a pending request. */
export type MintPatch = Partial<
  Pick<
    MintRequestRecord,
    | 'status'
    | 'attempts'
    | 'tokenUri'
    | 'metadataCid'
    | 'masterHash'
    | 'txHash'
    | 'tokenId'
    | 'failureCode'
    | 'submittedAt'
    | 'confirmedAt'
    | 'failedAt'
  >
>;
