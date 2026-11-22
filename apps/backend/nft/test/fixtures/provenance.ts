import type { MintRequestRecord } from '../../src/mint/mint-request';

/** Synthetic, deterministic test data. No real chain or account values. */
export const CONTENT_ID = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
export const CONTRACT = `0x${'ab'.repeat(20)}`;
export const TX_HASH = `0x${'1f'.repeat(32)}`;
export const MASTER_HASH = `0x${'c3'.repeat(32)}`;
export const METADATA_CID = 'bafkreimetadatacid0001';
export const TOKEN_URI = `ipfs://${METADATA_CID}`;
export const EXPLORER = 'https://testnet.snowtrace.io';
export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
export const REQUESTER_ID = '11111111-2222-4333-8444-555555555555';

export function mintRecord(
  overrides: Partial<MintRequestRecord> = {},
): MintRequestRecord {
  return {
    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    contentId: CONTENT_ID,
    requesterId: REQUESTER_ID,
    idempotencyKey: 'secret-key-value-123',
    status: 'confirmed',
    attempts: 1,
    chainId: 43113,
    contractAddress: CONTRACT,
    tokenUri: TOKEN_URI,
    metadataCid: METADATA_CID,
    masterHash: MASTER_HASH,
    txHash: TX_HASH,
    tokenId: '7',
    failureCode: null,
    requestId: 'req-internal-1',
    createdAt: new Date('2026-11-22T10:00:00.000Z'),
    updatedAt: new Date('2026-11-22T10:00:09.000Z'),
    submittedAt: new Date('2026-11-22T10:00:01.000Z'),
    confirmedAt: new Date('2026-11-22T10:00:09.000Z'),
    failedAt: null,
    ...overrides,
  };
}

export const ARTWORK = {
  mintedAt: new Date('2026-11-22T10:00:05.000Z'),
  category: 'Craft' as const,
  masterHash: MASTER_HASH,
  title: 'Lamba mena',
};
