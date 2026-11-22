import type {
  ContentId,
  MintVerification,
  Model3d,
  Provenance,
  ProvenanceMint,
} from './contract';
import { fixtureIds } from './fixtures';

// 3D and provenance fixtures for VITE_API_MODE=mock. Together they cover every
// 3D status, every mint status and every verification state. Hashes,
// addresses and CIDs are synthetic; the explorer is a local placeholder.

/** Items that exist only for their provenance state (no gallery entry). */
export const provenanceFixtureIds = {
  pending: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e11',
  mismatch: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e12',
  unverifiable: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e13',
} as const;

export const MOCK_EXPLORER = 'https://explorer.invalid';
export const MOCK_IPFS_GATEWAY = 'https://ipfs.invalid/ipfs';
export const MOCK_CONTRACT = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
export const MOCK_GALLERY_WALLET = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

export const PROVENANCE_SCOPE =
  'This certificate records that the LOVA gallery registered this published ' +
  'item on a public test blockchain, with a fingerprint of its master file. ' +
  'It does not prove physical authenticity, authorship or ownership of the ' +
  'work or of its rights.';

export const NO_MINT_SCOPE =
  'No certificate has been requested for this item. Its record in LOVA is ' +
  'unchanged; a certificate would only record a registration date.';

function hex(seed: number, bytes: number): string {
  return `0x${seed.toString(16).padStart(2, '0').repeat(bytes)}`;
}

const CHECKED_AT = '2026-11-22T10:05:00.000Z';

/** A pending mint as the NFT service returns it, before the transaction is sent. */
export function pendingMint(
  contentId: ContentId,
  seed: number,
  requestedAt = '2026-11-22T10:00:00.000Z',
): ProvenanceMint {
  return {
    mintId: `0b6d2c1a-0000-4000-8000-${String(seed).padStart(12, '0')}`,
    contentId,
    status: 'pending',
    network: {
      name: 'Ganache (local)',
      chainId: 31337,
      contractAddress: MOCK_CONTRACT,
    },
    tokenId: null,
    transactionHash: null,
    explorerUrl: null,
    failureReason: null,
    requestedAt,
    confirmedAt: null,
    explorer: { transaction: null, token: null },
  };
}

/** The confirmed form of a mint, with its NFT-05 display fields. */
export function confirmedMint(
  mint: ProvenanceMint,
  seed: number,
  verification: MintVerification['state'] = 'verified',
): ProvenanceMint {
  const tokenId = String(seed);
  const transactionHash = hex(seed, 32);
  const masterHash = hex(seed + 0x40, 32);
  const cid = `bafkreimockmetadata${String(seed).padStart(4, '0')}`;
  const tokenUri = `ipfs://${cid}`;
  const confirmedAt = '2026-11-22T10:00:05.000Z';
  const onChain = {
    title: 'Œuvre de démonstration',
    category: 'Craft',
    mintedAt: confirmedAt,
    masterHash,
    tokenUri,
    owner: MOCK_GALLERY_WALLET,
  };
  const checks: Record<MintVerification['state'], MintVerification> = {
    verified: {
      state: 'verified',
      fixity: true,
      onChain,
      checkedAt: CHECKED_AT,
    },
    mismatch: {
      state: 'mismatch',
      fixity: false,
      onChain: { ...onChain, masterHash: hex(0, 32) },
      checkedAt: CHECKED_AT,
    },
    unverifiable: {
      state: 'unverifiable',
      fixity: null,
      onChain: null,
      checkedAt: CHECKED_AT,
    },
  };
  return {
    ...mint,
    status: 'confirmed',
    tokenId,
    transactionHash,
    explorerUrl: `${MOCK_EXPLORER}/tx/${transactionHash}`,
    confirmedAt,
    explorer: {
      transaction: `${MOCK_EXPLORER}/tx/${transactionHash}`,
      token: `${MOCK_EXPLORER}/nft/${MOCK_CONTRACT}/${tokenId}`,
    },
    tokenUri,
    metadataUrl: `${MOCK_IPFS_GATEWAY}/${cid}`,
    metadataCid: cid,
    masterHash,
    mintedAt: confirmedAt,
    verification: checks[verification],
  };
}

/** The failed form of a mint, with its public failure code. */
export function failedMint(
  mint: ProvenanceMint,
  failureCode = 'CHAIN_UNAVAILABLE',
): ProvenanceMint {
  return {
    ...mint,
    status: 'failed',
    failureReason:
      'The blockchain network could not be reached. Try again later.',
    failureCode,
  };
}

function withMint(mint: ProvenanceMint): Provenance {
  return { contentId: mint.contentId, mint, scope: PROVENANCE_SCOPE };
}

export function noMint(contentId: ContentId): Provenance {
  return { contentId, mint: null, scope: NO_MINT_SCOPE };
}

export const fixtureProvenance: Provenance[] = [
  withMint(confirmedMint(pendingMint(fixtureIds.sculpture, 1), 1)),
  withMint(failedMint(pendingMint(fixtureIds.painting, 2))),
  noMint(fixtureIds.textile),
  // Read once as pending, then confirmed: the pending → confirmed transition.
  withMint(pendingMint(provenanceFixtureIds.pending, 3)),
  withMint(
    confirmedMint(pendingMint(provenanceFixtureIds.mismatch, 4), 4, 'mismatch'),
  ),
  withMint(
    confirmedMint(
      pendingMint(provenanceFixtureIds.unverifiable, 5),
      5,
      'unverifiable',
    ),
  ),
];

export const fixtureModels: Model3d[] = [
  {
    contentId: fixtureIds.sculpture,
    status: 'ready',
    variants: {
      poster: '/demo/sculpture/poster.webp',
      glb1k: '/demo/sculpture/model-1k.glb',
      glb2k: '/demo/sculpture/model-2k.glb',
    },
  },
  { contentId: fixtureIds.painting, status: 'missing', variants: null },
  { contentId: fixtureIds.textile, status: 'processing', variants: null },
];
