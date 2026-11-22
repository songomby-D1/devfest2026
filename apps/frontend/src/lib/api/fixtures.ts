import type { Item, Model3d, Provenance } from './contract';

// Demo fixtures for VITE_API_MODE=mock. Together they cover every value of
// PublicationStatus, ClaimStatus, the 3D status and the mint status so each
// screen state can be built without the backend. Media paths point to
// public/demo/, which stays local-only; a missing file exercises the fallbacks.

export const fixtureIds = {
  sculpture: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e01',
  painting: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e02',
  textile: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e03',
  draft: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e04',
  unpublished: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e05',
} as const;

export const fixtureItems: Item[] = [
  {
    id: fixtureIds.sculpture,
    publicationStatus: 'published',
    claims: { item: 'verified', description: 'verified' },
    title: 'Aloalo sculpté',
    description: 'Poteau funéraire sculpté en bois, région du Menabe.',
    imageUrl: '/demo/sculpture/poster.webp',
  },
  {
    id: fixtureIds.painting,
    publicationStatus: 'published',
    claims: { item: 'verified', description: 'uncertain' },
    title: 'Marché d’Analakely',
    description: 'Peinture à l’huile sur toile représentant un marché.',
    imageUrl: '/demo/painting/image.webp',
  },
  {
    id: fixtureIds.textile,
    publicationStatus: 'published',
    claims: { item: 'unreviewed', description: 'unreviewed' },
    title: 'Lamba mena',
    description: 'Étoffe de soie sauvage tissée à la main.',
    imageUrl: '/demo/textile/image.webp',
  },
  {
    id: fixtureIds.draft,
    publicationStatus: 'draft',
    claims: { item: 'unreviewed', description: 'unreviewed' },
    title: 'Valiha',
    description: 'Cithare tubulaire en bambou.',
    imageUrl: '/demo/valiha/image.webp',
  },
  {
    id: fixtureIds.unpublished,
    publicationStatus: 'unpublished',
    claims: { item: 'uncertain', description: 'uncertain' },
    title: 'Sobika',
    description: 'Panier tressé en fibres végétales.',
    imageUrl: '/demo/sobika/image.webp',
  },
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
  { contentId: fixtureIds.painting, status: 'missing' },
  { contentId: fixtureIds.textile, status: 'processing' },
];

export const fixtureProvenance: Provenance[] = [
  {
    contentId: fixtureIds.sculpture,
    mint: 'confirmed',
    tokenId: '1',
    transactionHash:
      '0x0000000000000000000000000000000000000000000000000000000000000001',
  },
  { contentId: fixtureIds.painting, mint: 'failed' },
  { contentId: fixtureIds.textile, mint: null },
];
