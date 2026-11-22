import type { ClaimReview, ItemDetail, Me, MediaRef } from './contract';

// Demo fixtures for VITE_API_MODE=mock, shaped exactly like packages/shared.
// Together they cover every value of PublicationStatus, SubmissionStatus and
// ClaimStatus so each screen state can be built without the backend;
// provenance-fixtures.ts covers the 3D and mint states. The four paintings are
// the real public-domain works of media-sources.md; their files sit in the
// Git-ignored public/media/, so a missing file exercises the missing-media
// state. Other items have no media on purpose.

export const fixtureIds = {
  sculpture: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e01',
  painting: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e02',
  textile: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e03',
  draft: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e04',
  unpublished: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e05',
  antongona: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e06',
  bridge: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e07',
  sikidy: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e08',
  returned: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e09',
  reviewerOwn: '6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e0a',
} as const;

/** Synthetic accounts. In mock mode they sign in with any password of 12+ characters. */
export const fixtureUsers = {
  curator: {
    userId: '0b7d1c4e-0000-4000-8000-000000000001',
    email: 'collection@lova.test',
    displayName: 'Collection LOVA',
    permissions: [],
  },
  contributor: {
    userId: '0b7d1c4e-0000-4000-8000-000000000002',
    email: 'contributrice@lova.test',
    displayName: 'Contributrice de démonstration',
    permissions: [],
  },
  reviewer: {
    userId: '0b7d1c4e-0000-4000-8000-000000000003',
    email: 'relecteur@lova.test',
    displayName: 'Relecteur de démonstration',
    permissions: ['reviewer'],
  },
} as const satisfies Record<string, Omit<Me, 'sessionExpiresAt'>>;

const CREATED = '2026-11-01T09:00:00.000Z';
const PUBLISHED = '2026-11-10T09:00:00.000Z';

function paintingMedia(id: string, file: string, caption: string): MediaRef {
  return {
    id,
    kind: 'image',
    mimeType: 'image/webp',
    bytes: 420_000,
    url: `/media/paintings/${file}-1600.webp`,
    caption,
  };
}

function review(
  target: ClaimReview['target'],
  outcome: ClaimReview['outcome'],
  rationale: string,
  evidence: string[] = [],
): ClaimReview {
  return {
    target,
    outcome,
    rationale,
    evidence,
    reviewerId: fixtureUsers.reviewer.userId,
    reviewedAt: '2026-11-08T14:00:00.000Z',
  };
}

interface FixtureDraft {
  id: string;
  title: string;
  kind: ItemDetail['kind'];
  description: string;
  creator: ItemDetail['creator'];
  origin: string | null;
  period: string | null;
  rights: string;
  media?: MediaRef[];
  publicationStatus: ItemDetail['publicationStatus'];
  submissionStatus: ItemDetail['submissionStatus'];
  reviews?: ClaimReview[];
  advisorySignals?: ItemDetail['advisorySignals'];
}

function detail(draft: FixtureDraft): ItemDetail {
  const media = draft.media ?? [];
  const reviews = draft.reviews ?? [];
  const status = (target: ClaimReview['target']) =>
    reviews.find((entry) => entry.target === target)?.outcome ?? 'unreviewed';
  const image = media.find((entry) => entry.kind === 'image');
  return {
    id: draft.id,
    title: draft.title,
    kind: draft.kind,
    creatorName: draft.creator.name,
    origin: draft.origin,
    period: draft.period,
    thumbnailUrl: image?.url ?? null,
    publicationStatus: draft.publicationStatus,
    submissionStatus: draft.submissionStatus,
    claims: { item: status('item'), description: status('description') },
    updatedAt: CREATED,
    description: draft.description,
    creator: draft.creator,
    rights: { statement: draft.rights, confirmed: true },
    media,
    reviews,
    isOwner: false,
    ...(draft.advisorySignals === undefined
      ? {}
      : { advisorySignals: draft.advisorySignals }),
    createdAt: CREATED,
    publishedAt: draft.publicationStatus === 'published' ? PUBLISHED : null,
  };
}

/** Fixture items, in gallery order, with the account that owns each one. */
export const fixtureItems: readonly { ownerId: string; item: ItemDetail }[] = [
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.painting,
      title: 'Femme malgache',
      kind: 'painting',
      description:
        'Une femme debout, drapée dans un lamba rayé, devant des maisons. Le titre d’origine est « Malagasy Woman ».\n\nAntonio Zeno Shindler (1813–1899) a peint des portraits de peuples du monde pour la Smithsonian Institution.',
      creator: {
        name: 'Antonio Zeno Shindler',
        community: null,
        technique: 'Huile sur toile',
      },
      origin: 'Madagascar, lieu non précisé',
      period: 'vers 1893',
      rights:
        'Domaine public : l’auteur est mort en 1899. Image diffusée par le Smithsonian Open Access sous licence CC0.',
      media: [
        paintingMedia(
          '7a000000-0000-4000-8000-000000000001',
          'shindler-malagasy-woman',
          'Peinture d’une femme malgache debout, drapée dans un lamba rayé, devant des maisons.',
        ),
      ],
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review(
          'item',
          'verified',
          'Conforme à la notice 1985.66.165,709 du Smithsonian American Art Museum (artiste, date, technique).',
          ['Smithsonian American Art Museum, 1985.66.165,709'],
        ),
        review('description', 'verified', 'Description relue avec la notice.'),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.antongona,
      title: 'Antongona',
      kind: 'painting',
      description:
        'Une colline de granit de l’Imerina, ses maisons et ses terrasses, peintes en couleurs en 1875.\n\nAntongona est l’un des anciens sites fortifiés des collines qui entourent Antananarivo.',
      creator: {
        name: 'Anonyme, monogramme « W.J. »',
        community: null,
        technique: 'Encre, aquarelle et gouache sur papier',
      },
      origin: 'Imerina, Hautes Terres',
      period: '1875',
      rights:
        'Domaine public : œuvre de 1875. Reproduction photographique d’une œuvre en deux dimensions, via Wikimedia Commons.',
      media: [
        paintingMedia(
          '7a000000-0000-4000-8000-000000000002',
          'anonymous-antongona',
          'Aquarelle d’une colline rocheuse de l’Imerina avec des maisons, de la terre rouge et des terrasses.',
        ),
      ],
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review(
          'item',
          'verified',
          'Date et monogramme confirmés par la vente Abbott and Holder de 2020.',
        ),
        review(
          'description',
          'uncertain',
          'L’identification du site comme la forteresse d’Antongona est plausible mais n’est pas confirmée par une seconde source.',
        ),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.bridge,
      title: 'Pont d’Ambaniala',
      kind: 'painting',
      description:
        'Une chaussée traverse les rizières, avec des zébus et les collines à l’horizon.\n\nWilliam Ellis (1794–1872), missionnaire et auteur, a publié cette vue dans son histoire de Madagascar.',
      creator: {
        name: 'William Ellis',
        community: null,
        technique: 'Lithographie',
      },
      origin: 'Imerina, Hautes Terres',
      period: '1838',
      rights:
        'Domaine public : l’auteur est mort en 1872. Reproduction via Wikimedia Commons.',
      media: [
        paintingMedia(
          '7a000000-0000-4000-8000-000000000003',
          'ellis-bridge-at-ambaniala',
          'Lithographie d’une chaussée traversant des rizières, avec des zébus et des collines.',
        ),
      ],
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review(
          'item',
          'verified',
          'Planche de « History of Madagascar », volume 2, Londres, 1838.',
        ),
        review('description', 'verified', 'Description conforme à la planche.'),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.sikidy,
      title: 'Scène de divination par le sikidy, Tananarive',
      kind: 'painting',
      description:
        'Un intérieur aux murs de terre rouge, où des personnes en lamba assistent à une séance de sikidy, la divination par les graines.',
      creator: {
        name: 'Henri Ratovo',
        community: null,
        technique: 'Peinture, technique non confirmée',
      },
      origin: 'Antananarivo, Hautes Terres',
      period: '1912',
      rights:
        'Domaine public à Madagascar (loi n° 94-036). La date de décès de l’auteur reste à vérifier.',
      media: [
        paintingMedia(
          '7a000000-0000-4000-8000-000000000004',
          'ratovo-sikidy-tananarive',
          'Peinture d’un intérieur aux murs rouges où des personnes en lamba entourent un devin.',
        ),
      ],
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review(
          'item',
          'uncertain',
          'Attribution issue d’un catalogue de vente ; détenteur actuel non confirmé.',
        ),
        review(
          'description',
          'uncertain',
          'Technique non confirmée par une source indépendante.',
        ),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.sculpture,
      title: 'Aloalo sculpté',
      kind: 'sculpture',
      description: 'Poteau funéraire sculpté en bois, région du Menabe.',
      creator: { name: null, community: 'Mahafaly', technique: 'Bois sculpté' },
      origin: 'Sud-Ouest de Madagascar',
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review('item', 'verified', 'Fixture synthétique.'),
        review('description', 'verified', 'Fixture synthétique.'),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.curator.userId,
    item: detail({
      id: fixtureIds.textile,
      title: 'Lamba mena',
      kind: 'textile',
      description: 'Étoffe de soie sauvage tissée à la main.',
      creator: {
        name: null,
        community: 'Hautes Terres',
        technique: 'Soie sauvage tissée',
      },
      origin: 'Hautes Terres',
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      reviews: [
        review('item', 'verified', 'Fixture synthétique.'),
        review('description', 'uncertain', 'Fixture synthétique.'),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.contributor.userId,
    item: detail({
      id: fixtureIds.draft,
      title: 'Valiha',
      kind: 'object',
      description: 'Cithare tubulaire en bambou.',
      creator: { name: null, community: null, technique: 'Bambou' },
      origin: null,
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      advisorySignals: [
        {
          kind: 'description_mismatch',
          score: 0.2,
          source: 'fixture',
          note: 'Signal synthétique pour les tests.',
          createdAt: CREATED,
        },
      ],
    }),
  },
  {
    ownerId: fixtureUsers.contributor.userId,
    item: detail({
      id: fixtureIds.unpublished,
      title: 'Sobika',
      kind: 'object',
      description: 'Panier tressé en fibres végétales.',
      creator: { name: null, community: null, technique: 'Vannerie' },
      origin: null,
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'unpublished',
      submissionStatus: 'accepted',
      reviews: [
        review('item', 'uncertain', 'Fixture synthétique.'),
        review('description', 'uncertain', 'Fixture synthétique.'),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.contributor.userId,
    item: detail({
      id: fixtureIds.returned,
      title: 'Sinibe',
      kind: 'object',
      description: 'Grande jarre à eau en terre cuite.',
      creator: { name: null, community: null, technique: 'Terre cuite' },
      origin: 'Hautes Terres',
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'draft',
      submissionStatus: 'returned',
      reviews: [
        review(
          'item',
          'verified',
          'Fixture synthétique : objet conforme à la photographie.',
        ),
      ],
    }),
  },
  {
    ownerId: fixtureUsers.reviewer.userId,
    item: detail({
      id: fixtureIds.reviewerOwn,
      title: 'Lokanga',
      kind: 'object',
      description: 'Vièle à trois cordes.',
      creator: { name: null, community: null, technique: null },
      origin: null,
      period: null,
      rights: 'Fixture synthétique : aucun média réel.',
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
    }),
  },
];
