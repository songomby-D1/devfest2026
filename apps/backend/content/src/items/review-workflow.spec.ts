import { InMemoryItemRepository } from '../../test/support/in-memory-item-repository';
import {
  GUEST,
  OTHER,
  OWNER,
  REVIEWER,
  REVIEWER_ID,
  callerOf,
  createBody,
} from '../../test/support/fixtures';
import { parseOrThrow } from '../common/zod-validation';
import { assertMediaEditable } from '../media/media.service';
import { listItemsQuerySchema } from './item-list';
import {
  type ReviewInput,
  createItemSchema,
  reviewSchema,
  updateItemSchema,
} from './item-schemas';
import { ItemsService } from './items.service';

const SECOND_REVIEWER = callerOf('9c4d5e6f-7a8b-4c3d-9e4f-5a6b7c8d9e0f', [
  'reviewer',
]);

function reviewInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return parseOrThrow(reviewSchema, {
    target: 'item',
    outcome: 'verified',
    rationale: 'Matches the museum inventory card.',
    evidence: ['Inventory card 1932-14'],
    ...overrides,
  });
}

describe('review workflow (CONTENT-04)', () => {
  let repository: InMemoryItemRepository;
  let service: ItemsService;

  beforeEach(() => {
    repository = new InMemoryItemRepository();
    service = new ItemsService(repository);
  });

  async function submit(caller = OWNER) {
    return service.create(caller, parseOrThrow(createItemSchema, createBody()));
  }

  const stored = (id: string) => {
    const item = repository.items.get(id);
    if (item === undefined) throw new Error('missing item');
    return item;
  };

  const edit = (id: string, patch: Record<string, unknown>) =>
    service.update(OWNER, id, parseOrThrow(updateItemSchema, patch));

  async function reviewBoth(id: string): Promise<void> {
    await service.review(REVIEWER, id, reviewInput({ target: 'item' }));
    await service.review(
      REVIEWER,
      id,
      reviewInput({ target: 'description', outcome: 'uncertain' }),
    );
  }

  const reviewQueue = async () =>
    (
      await service.list(
        SECOND_REVIEWER,
        parseOrThrow(listItemsQuerySchema, { scope: 'review' }),
      )
    ).items.map((item) => item.id);

  describe('review', () => {
    it('sets the item claim only and records the review', async () => {
      const { id } = await submit();

      const item = await service.review(REVIEWER, id, reviewInput());

      expect(item.claims).toEqual({
        item: 'verified',
        description: 'unreviewed',
      });
      expect(item.reviews).toEqual([
        {
          target: 'item',
          outcome: 'verified',
          rationale: 'Matches the museum inventory card.',
          evidence: ['Inventory card 1932-14'],
          reviewerId: REVIEWER_ID,
          reviewedAt: expect.any(String) as string,
        },
      ]);
      expect(repository.reviews).toEqual([
        expect.objectContaining({
          itemId: id,
          target: 'item',
          fromStatus: 'unreviewed',
          outcome: 'verified',
          reviewerId: REVIEWER_ID,
        }),
      ]);
    });

    it('sets the description claim separately from the item claim', async () => {
      const { id } = await submit();

      const item = await service.review(
        REVIEWER,
        id,
        reviewInput({ target: 'description', outcome: 'uncertain' }),
      );

      expect(item.claims).toEqual({
        item: 'unreviewed',
        description: 'uncertain',
      });
      expect(item.reviews.map((review) => review.target)).toEqual([
        'description',
      ]);
    });

    it('keeps every review in the history and shows the latest per target', async () => {
      const { id } = await submit();
      await service.review(REVIEWER, id, reviewInput());
      await service.review(
        SECOND_REVIEWER,
        id,
        reviewInput({ outcome: 'uncertain', rationale: 'Source disputed.' }),
      );

      const item = await service.get(OWNER, id);

      expect(item.claims.item).toBe('uncertain');
      expect(item.reviews).toHaveLength(1);
      expect(item.reviews[0]).toMatchObject({
        outcome: 'uncertain',
        rationale: 'Source disputed.',
      });
      expect(
        repository.reviews.map((review) => [review.fromStatus, review.outcome]),
      ).toEqual([
        ['unreviewed', 'verified'],
        ['verified', 'uncertain'],
      ]);
      const [first, second] = repository.reviews;
      expect(second?.reviewedAt.getTime()).toBeGreaterThan(
        first?.reviewedAt.getTime() ?? Infinity,
      );
    });

    it.each([
      ['a guest', GUEST, 'UNAUTHENTICATED'],
      ['the owner', OWNER, 'FORBIDDEN'],
      ['another user', OTHER, 'FORBIDDEN'],
    ])('refuses %s', async (_name, caller, code) => {
      const { id } = await submit();

      await expect(
        service.review(caller, id, reviewInput()),
      ).rejects.toMatchObject({ code });
      expect(stored(id).claimStatus).toBe('unreviewed');
      expect(repository.reviews).toHaveLength(0);
    });

    it('forbids a reviewer to review their own submission', async () => {
      const { id } = await submit(REVIEWER);

      await expect(
        service.review(REVIEWER, id, reviewInput()),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
      expect(repository.reviews).toHaveLength(0);
    });

    it('answers NOT_FOUND for an unknown item', async () => {
      await expect(
        service.review(
          REVIEWER,
          '00000000-0000-4000-8000-000000000000',
          reviewInput(),
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it.each(['returned', 'rejected', 'accepted'] as const)(
      'refuses a %s submission with 422',
      async (submissionStatus) => {
        const { id } = await submit();
        repository.patchRecord(id, { submissionStatus });

        await expect(
          service.review(REVIEWER, id, reviewInput()),
        ).rejects.toMatchObject({
          code: 'SUBMISSION_NOT_IN_REVIEW',
          status: 422,
        });
        expect(stored(id).claimStatus).toBe('unreviewed');
      },
    );

    it('does not publish by itself: publication stays a decision', async () => {
      const { id } = await submit();
      await reviewBoth(id);

      expect(stored(id).publicationStatus).toBe('draft');
      const published = await service.decide(REVIEWER, id, {
        decision: 'publish',
        note: 'Both claims reviewed',
      });
      expect(published).toMatchObject({
        publicationStatus: 'published',
        submissionStatus: 'accepted',
        claims: { item: 'verified', description: 'uncertain' },
      });
    });

    it('shows the reviews of a published item to guests', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.publish(REVIEWER, id, '');

      const item = await service.get(GUEST, id);

      expect(item.reviews.map((review) => review.target).sort()).toEqual([
        'description',
        'item',
      ]);
      expect(item).not.toHaveProperty('advisorySignals');
    });
  });

  describe('edits reopen claims (D18 re-review)', () => {
    it('hides a review once an edit resets its claim', async () => {
      const { id } = await submit();
      await reviewBoth(id);

      const item = await edit(id, { title: 'Lamba mena (detail)' });

      expect(item.claims).toEqual({
        item: 'unreviewed',
        description: 'uncertain',
      });
      expect(item.reviews.map((review) => review.target)).toEqual([
        'description',
      ]);
      expect(repository.reviews).toHaveLength(2);
    });

    it('resets the description claim on a text edit', async () => {
      const { id } = await submit();
      await reviewBoth(id);

      const item = await edit(id, { description: 'A new text.' });

      expect(item.claims).toEqual({
        item: 'verified',
        description: 'unreviewed',
      });
    });
  });

  describe('return', () => {
    it('sends a submission in review back to its owner', async () => {
      const { id } = await submit();

      const item = await service.decide(REVIEWER, id, {
        decision: 'return',
        note: 'Please add the weaving period.',
      });

      expect(item).toMatchObject({
        submissionStatus: 'returned',
        publicationStatus: 'draft',
      });
      expect(repository.events).toEqual([
        {
          itemId: id,
          action: 'return',
          actorId: REVIEWER_ID,
          note: 'Please add the weaving period.',
        },
      ]);
      expect(await reviewQueue()).not.toContain(id);
    });

    it('is a no-op on a returned submission', async () => {
      const { id } = await submit();
      const decision = { decision: 'return' as const, note: 'Fix it' };
      await service.decide(REVIEWER, id, decision);

      const again = await service.decide(REVIEWER, id, decision);

      expect(again.submissionStatus).toBe('returned');
      expect(repository.events).toHaveLength(1);
    });

    it('puts the submission back in review after an owner edit', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.decide(REVIEWER, id, { decision: 'return', note: 'Fix' });

      const item = await edit(id, { period: 'Around 1910' });

      expect(item.submissionStatus).toBe('in_review');
      expect(item.claims.item).toBe('unreviewed');
      expect(await reviewQueue()).toContain(id);
    });

    it('puts it back in review on a rights-only edit, keeping the claims', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.decide(REVIEWER, id, { decision: 'return', note: 'Fix' });

      const item = await edit(id, { rightsStatement: 'Family collection.' });

      expect(item.submissionStatus).toBe('in_review');
      expect(item.claims).toEqual({
        item: 'verified',
        description: 'uncertain',
      });
    });

    it('stays returned after an edit that changes nothing', async () => {
      const { id } = await submit();
      await service.decide(REVIEWER, id, { decision: 'return', note: 'Fix' });

      const item = await edit(id, { title: 'Lamba mena' });

      expect(item.submissionStatus).toBe('returned');
    });

    it('refuses an accepted submission with 422', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.publish(REVIEWER, id, '');

      await expect(
        service.decide(REVIEWER, id, { decision: 'return', note: 'Late' }),
      ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_IN_REVIEW' });
    });

    it('forbids a reviewer to return their own submission', async () => {
      const { id } = await submit(REVIEWER);

      await expect(
        service.decide(REVIEWER, id, { decision: 'return', note: 'Mine' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(stored(id).submissionStatus).toBe('in_review');
    });
  });

  describe('reject', () => {
    it.each(['in_review', 'returned'] as const)(
      'closes a %s submission',
      async (submissionStatus) => {
        const { id } = await submit();
        repository.patchRecord(id, { submissionStatus });

        const item = await service.decide(REVIEWER, id, {
          decision: 'reject',
          note: 'Not a cultural item.',
        });

        expect(item.submissionStatus).toBe('rejected');
        expect(repository.events.at(-1)).toMatchObject({ action: 'reject' });
      },
    );

    it('is terminal: no edit, media change, review or publication', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.decide(REVIEWER, id, { decision: 'reject', note: 'No' });

      await expect(edit(id, { title: 'Again' })).rejects.toMatchObject({
        code: 'SUBMISSION_REJECTED',
        status: 409,
      });
      let mediaError: unknown;
      try {
        assertMediaEditable(stored(id), OWNER);
      } catch (error) {
        mediaError = error;
      }
      expect(mediaError).toMatchObject({ code: 'SUBMISSION_REJECTED' });
      await expect(
        service.review(SECOND_REVIEWER, id, reviewInput()),
      ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_IN_REVIEW' });
      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'SUBMISSION_NOT_PUBLISHABLE',
      });
      await expect(
        service.decide(REVIEWER, id, { decision: 'return', note: 'Hm' }),
      ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_IN_REVIEW' });
      expect(stored(id).title).toBe('Lamba mena');
    });

    it('is a no-op on a rejected submission', async () => {
      const { id } = await submit();
      const decision = { decision: 'reject' as const, note: 'No' };
      await service.decide(REVIEWER, id, decision);

      await service.decide(REVIEWER, id, decision);

      expect(repository.events).toHaveLength(1);
    });

    it('refuses an accepted submission: unpublish takes it down', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.publish(REVIEWER, id, '');

      await expect(
        service.decide(REVIEWER, id, { decision: 'reject', note: 'Late' }),
      ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_IN_REVIEW' });
      expect(stored(id).publicationStatus).toBe('published');
    });
  });

  describe('an unpublished item edited by its owner', () => {
    it('goes back in review and needs a new review before republishing', async () => {
      const { id } = await submit();
      await reviewBoth(id);
      await service.publish(REVIEWER, id, '');
      await service.unpublish(REVIEWER, id, { note: 'Takedown' });
      expect(await reviewQueue()).not.toContain(id);

      const item = await edit(id, { description: 'Corrected text.' });

      expect(item).toMatchObject({
        publicationStatus: 'unpublished',
        submissionStatus: 'in_review',
        claims: { item: 'verified', description: 'unreviewed' },
      });
      expect(await reviewQueue()).toContain(id);
      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'CLAIMS_UNREVIEWED',
      });

      await service.review(
        SECOND_REVIEWER,
        id,
        reviewInput({ target: 'description' }),
      );
      const republished = await service.publish(REVIEWER, id, 'Fixed');
      expect(republished).toMatchObject({
        publicationStatus: 'published',
        submissionStatus: 'accepted',
      });
    });
  });
});
