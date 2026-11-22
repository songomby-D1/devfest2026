import { PublicError } from '../common/public-error';
import type { ItemRecord } from './item';
import { planPublish, planUnpublish, publishBlocker } from './publication';

const NOW = new Date('2026-11-22T10:00:00.000Z');
const REVIEWER_ID = '8b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e';

function record(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: '1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a',
    ownerId: '6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
    title: 'Lamba mena',
    kind: 'textile',
    origin: null,
    period: null,
    author: { name: null, community: null, technique: null },
    rights: { statement: 'Mine', confirmed: true },
    description: { text: 'A shroud.', claimStatus: 'verified' },
    publicationStatus: 'draft',
    submissionStatus: 'in_review',
    claimStatus: 'uncertain',
    publishedAt: null,
    createdAt: new Date('2026-11-22T08:00:00.000Z'),
    updatedAt: new Date('2026-11-22T08:00:00.000Z'),
    media: [],
    latestReviews: [],
    ...overrides,
  };
}

function codeOf(run: () => unknown): { code: string; status: number } {
  try {
    run();
  } catch (error) {
    if (error instanceof PublicError) {
      return { code: error.code, status: error.getStatus() };
    }
    throw error;
  }
  throw new Error('expected a PublicError');
}

describe('publishBlocker', () => {
  it('accepts reviewed claims, including uncertain, with confirmed rights', () => {
    expect(publishBlocker(record())).toBeNull();
    expect(
      publishBlocker(
        record({
          submissionStatus: 'accepted',
          publicationStatus: 'unpublished',
        }),
      ),
    ).toBeNull();
  });

  it.each([
    [{ submissionStatus: 'returned' as const }, 'SUBMISSION_NOT_PUBLISHABLE'],
    [{ submissionStatus: 'rejected' as const }, 'SUBMISSION_NOT_PUBLISHABLE'],
    [{ claimStatus: 'unreviewed' as const }, 'CLAIMS_UNREVIEWED'],
    [
      {
        description: { text: 'A shroud.', claimStatus: 'unreviewed' as const },
      },
      'CLAIMS_UNREVIEWED',
    ],
    [
      { rights: { statement: 'Mine', confirmed: false } },
      'RIGHTS_NOT_CONFIRMED',
    ],
  ])('blocks %o with %s', (overrides, rule) => {
    expect(publishBlocker(record(overrides))).toBe(rule);
  });
});

describe('planPublish', () => {
  it('publishes a draft, accepts the submission and stamps publishedAt', () => {
    expect(planPublish(record(), REVIEWER_ID, 'Checked', NOW)).toEqual({
      action: 'publish',
      actorId: REVIEWER_ID,
      note: 'Checked',
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      publishedAt: NOW,
    });
  });

  it('republishes an unpublished item with a new publishedAt', () => {
    const item = record({
      publicationStatus: 'unpublished',
      submissionStatus: 'accepted',
      publishedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(planPublish(item, REVIEWER_ID, '', NOW)).toMatchObject({
      publicationStatus: 'published',
      publishedAt: NOW,
    });
  });

  it('is a no-op on a published item', () => {
    expect(
      planPublish(
        record({ publicationStatus: 'published', claimStatus: 'unreviewed' }),
        REVIEWER_ID,
        '',
        NOW,
      ),
    ).toBeNull();
  });

  it('answers 422 with the rule code when a rule blocks', () => {
    expect(
      codeOf(() =>
        planPublish(
          record({ claimStatus: 'unreviewed' }),
          REVIEWER_ID,
          '',
          NOW,
        ),
      ),
    ).toEqual({ code: 'CLAIMS_UNREVIEWED', status: 422 });
  });
});

describe('planUnpublish', () => {
  it('unpublishes a published item and keeps publishedAt', () => {
    const publishedAt = new Date('2026-11-01T00:00:00.000Z');
    const item = record({
      publicationStatus: 'published',
      submissionStatus: 'accepted',
      publishedAt,
    });
    expect(planUnpublish(item, REVIEWER_ID, 'Rights dispute')).toEqual({
      action: 'unpublish',
      actorId: REVIEWER_ID,
      note: 'Rights dispute',
      publicationStatus: 'unpublished',
      submissionStatus: 'accepted',
      publishedAt,
    });
  });

  it('is a no-op on an unpublished item', () => {
    expect(
      planUnpublish(
        record({ publicationStatus: 'unpublished' }),
        REVIEWER_ID,
        '',
      ),
    ).toBeNull();
  });

  it('answers 409 ITEM_NOT_PUBLISHED for a draft', () => {
    expect(codeOf(() => planUnpublish(record(), REVIEWER_ID, ''))).toEqual({
      code: 'ITEM_NOT_PUBLISHED',
      status: 409,
    });
  });
});
