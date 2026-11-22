import { itemSnapshotSchema } from './content-snapshot-client';
import {
  buildMetadata,
  chooseMaster,
  CLAIMS_NOTE,
  toContractCategory,
  truncateUtf8,
} from './metadata-builder';

const CONTENT_ID = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const MASTER_HASH = `0x${'ab'.repeat(32)}`;

/** A full `ItemDetail` as Content returns it, private fields included. */
function itemDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTENT_ID,
    title: 'Lamba mena',
    kind: 'textile',
    creatorName: 'Rasoa',
    origin: 'Arivonimamo',
    period: 'XIXe',
    thumbnailUrl: `/api/items/${CONTENT_ID}/media/${IMAGE_ID}`,
    publicationStatus: 'published',
    submissionStatus: 'accepted',
    claims: { item: 'verified', description: 'uncertain' },
    updatedAt: '2026-11-22T10:00:00.000Z',
    description: 'Silk burial shroud.',
    creator: { name: 'Rasoa', community: 'Merina', technique: 'Weaving' },
    rights: { statement: 'PRIVATE-RIGHTS-NOTE', confirmed: true },
    media: [
      {
        id: IMAGE_ID,
        kind: 'image',
        mimeType: 'image/png',
        bytes: 3,
        url: `/api/items/${CONTENT_ID}/media/${IMAGE_ID}`,
        caption: 'PRIVATE-CAPTION',
      },
    ],
    reviews: [
      {
        target: 'item',
        outcome: 'verified',
        rationale: 'PRIVATE-RATIONALE',
        evidence: ['PRIVATE-EVIDENCE'],
        reviewerId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        reviewedAt: '2026-11-22T09:00:00.000Z',
      },
    ],
    isOwner: true,
    ownerId: 'ffffffff-0000-4000-8000-000000000000',
    ownerEmail: 'owner@example.org',
    advisorySignals: [],
    internalNote: 'PRIVATE-NOTE',
    createdAt: '2026-11-20T10:00:00.000Z',
    publishedAt: '2026-11-22T10:00:00.000Z',
    ...overrides,
  };
}

function metadataFor(detail: Record<string, unknown>, withPreview = true) {
  const item = itemSnapshotSchema.parse(detail);
  return buildMetadata({
    item,
    contentId: CONTENT_ID,
    category: toContractCategory(item.kind),
    masterHash: MASTER_HASH,
    preview: withPreview ? { cid: 'bafkpreview', mimeType: 'image/png' } : null,
  });
}

function keysOf(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => keysOf(entry, `${path}[]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) => {
      const child = path === '' ? key : `${path}.${key}`;
      return [child, ...keysOf(entry, child)];
    });
  }
  return [];
}

describe('buildMetadata', () => {
  it('produces the ERC-721 metadata from public fields', () => {
    expect(metadataFor(itemDetail())).toEqual({
      name: 'Lamba mena',
      description: 'Silk burial shroud.',
      image: 'ipfs://bafkpreview',
      attributes: [
        { trait_type: 'Kind', value: 'textile' },
        { trait_type: 'Category', value: 'Craft' },
        { trait_type: 'Creator', value: 'Rasoa' },
        { trait_type: 'Community', value: 'Merina' },
        { trait_type: 'Technique', value: 'Weaving' },
        { trait_type: 'Origin', value: 'Arivonimamo' },
        { trait_type: 'Period', value: 'XIXe' },
        { trait_type: 'Item claim', value: 'verified' },
        { trait_type: 'Description claim', value: 'uncertain' },
      ],
      properties: {
        contentId: CONTENT_ID,
        category: 'Craft',
        kind: 'textile',
        master_sha256: MASTER_HASH,
        claims_note: CLAIMS_NOTE,
        files: [
          { uri: 'ipfs://bafkpreview', type: 'image/png', role: 'preview' },
        ],
      },
    });
  });

  it('contains only allowlisted keys and no private value', () => {
    const metadata = metadataFor(itemDetail());
    const json = JSON.stringify(metadata);

    expect([...new Set(keysOf(metadata))].sort()).toEqual(
      [
        'name',
        'description',
        'image',
        'attributes',
        'attributes[].trait_type',
        'attributes[].value',
        'properties',
        'properties.contentId',
        'properties.category',
        'properties.kind',
        'properties.master_sha256',
        'properties.claims_note',
        'properties.files',
        'properties.files[].uri',
        'properties.files[].type',
        'properties.files[].role',
      ].sort(),
    );
    for (const secret of [
      'PRIVATE',
      'owner@example.org',
      'ffffffff-0000',
      'aaaaaaaa-bbbb',
      IMAGE_ID,
      '/api/items',
      '2026-11-2',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('never presents a claim status as AI verification', () => {
    const json = JSON.stringify(metadataFor(itemDetail())).toLowerCase();

    expect(json).not.toMatch(/\bai\b|artificial|automat|machine/);
    expect(CLAIMS_NOTE).toContain('human community reviewers');
  });

  it('leaves out empty optional fields and the image when there is none', () => {
    const metadata = metadataFor(
      itemDetail({
        origin: null,
        period: '  ',
        creator: { name: null, community: null, technique: null },
        claims: { item: 'unreviewed', description: 'unreviewed' },
      }),
      false,
    );

    expect(metadata).not.toHaveProperty('image');
    expect(metadata.properties.files).toEqual([]);
    expect(metadata.attributes.map((a) => a.trait_type)).toEqual([
      'Kind',
      'Category',
      'Item claim',
      'Description claim',
    ]);
    expect(metadata.attributes.at(-1)?.value).toBe('unreviewed');
  });

  it('is deterministic for the same snapshot', () => {
    expect(JSON.stringify(metadataFor(itemDetail()))).toBe(
      JSON.stringify(metadataFor(itemDetail({ updatedAt: 'later' }))),
    );
  });
});

describe('toContractCategory', () => {
  it.each([
    ['painting', 'Painting'],
    ['sculpture', 'Sculpture'],
    ['photograph', 'Craft'],
    ['textile', 'Craft'],
    ['object', 'Craft'],
    ['other', 'Craft'],
    ['future-kind', 'Craft'],
  ])('maps %s to %s', (kind, category) => {
    expect(toContractCategory(kind)).toBe(category);
  });
});

describe('truncateUtf8', () => {
  const bytes = (text: string): number => new TextEncoder().encode(text).length;

  it('keeps a title that fits', () => {
    expect(truncateUtf8('a'.repeat(256), 256)).toBe('a'.repeat(256));
  });

  it('cuts ASCII at the limit', () => {
    expect(truncateUtf8('a'.repeat(300), 256)).toBe('a'.repeat(256));
  });

  it('never splits a multi-byte character', () => {
    // 'é' is 2 bytes: 255 ASCII bytes leave room for no further 'é'.
    const result = truncateUtf8(`${'a'.repeat(255)}éé`, 256);
    expect(result).toBe('a'.repeat(255));
    expect(bytes(result)).toBeLessThanOrEqual(256);
  });

  it('never splits a grapheme cluster', () => {
    const family = '👨‍👩‍👧'; // 18 bytes, one grapheme
    const result = truncateUtf8(`${'a'.repeat(250)}${family}`, 256);
    expect(result).toBe('a'.repeat(250));
  });

  it('cuts long non-Latin titles within the limit', () => {
    const result = truncateUtf8('ā'.repeat(200), 256);
    expect(bytes(result)).toBe(256);
    expect(result).toBe('ā'.repeat(128));
  });
});

describe('chooseMaster', () => {
  const video = {
    id: 'v',
    kind: 'video' as const,
    mimeType: 'video/mp4',
    bytes: 1,
  };
  const image1 = {
    id: 'i1',
    kind: 'image' as const,
    mimeType: 'image/png',
    bytes: 1,
  };
  const image2 = {
    id: 'i2',
    kind: 'image' as const,
    mimeType: 'image/jpeg',
    bytes: 1,
  };

  it('takes the first image in Content order', () => {
    expect(chooseMaster([video, image1, image2])).toBe(image1);
  });

  it('falls back to the first video, then to none', () => {
    expect(chooseMaster([video])).toBe(video);
    expect(chooseMaster([])).toBeNull();
  });
});
