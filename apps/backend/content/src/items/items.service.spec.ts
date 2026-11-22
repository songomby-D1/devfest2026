import { InMemoryItemRepository } from '../../test/support/in-memory-item-repository';
import {
  GUEST,
  OTHER,
  OWNER,
  OWNER_ID,
  REVIEWER,
  REVIEWER_ID,
  callerOf,
  createBody,
} from '../../test/support/fixtures';
import { parseOrThrow } from '../common/zod-validation';
import { listItemsQuerySchema } from './item-list';
import { createItemSchema } from './item-schemas';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let repository: InMemoryItemRepository;
  let service: ItemsService;

  beforeEach(() => {
    repository = new InMemoryItemRepository();
    service = new ItemsService(repository);
  });

  async function submit() {
    return service.create(OWNER, parseOrThrow(createItemSchema, createBody()));
  }

  describe('create', () => {
    it('stores a draft in review with both claims unreviewed', async () => {
      const item = await submit();

      expect(item).toMatchObject({
        title: 'Lamba mena',
        kind: 'textile',
        creatorName: 'Rasoa',
        creator: {
          name: 'Rasoa',
          community: 'Merina weavers',
          technique: 'Hand-woven silk',
        },
        rights: { confirmed: true },
        publicationStatus: 'draft',
        submissionStatus: 'in_review',
        claims: { item: 'unreviewed', description: 'unreviewed' },
        isOwner: true,
        advisorySignals: [],
        media: [],
        reviews: [],
        publishedAt: null,
      });
      expect(repository.items.get(item.id)?.ownerId).toBe(OWNER_ID);
    });

    it('requires a signed-in caller', async () => {
      await expect(
        service.create(GUEST, parseOrThrow(createItemSchema, createBody())),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(repository.items.size).toBe(0);
    });
  });

  describe('get', () => {
    it('shows a draft to its owner and to reviewers', async () => {
      const { id } = await submit();

      await expect(service.get(OWNER, id)).resolves.toMatchObject({
        isOwner: true,
      });
      await expect(service.get(REVIEWER, id)).resolves.toMatchObject({
        isOwner: false,
        advisorySignals: [],
      });
    });

    it.each([
      ['a guest', GUEST],
      ['another user', OTHER],
    ])('hides a draft from %s with NOT_FOUND', async (_name, caller) => {
      const { id } = await submit();

      await expect(service.get(caller, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('hides an unpublished item from guests', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { publicationStatus: 'unpublished' });

      await expect(service.get(GUEST, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('shows a published item to guests without advisory signals', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { publicationStatus: 'published' });

      const item = await service.get(GUEST, id);
      expect(item.isOwner).toBe(false);
      expect(item).not.toHaveProperty('advisorySignals');
    });

    it('answers NOT_FOUND for an unknown ID', async () => {
      await expect(
        service.get(OWNER, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('update', () => {
    it('lets the owner edit and reopens only the changed claims (D18)', async () => {
      const { id } = await submit();
      repository.patchRecord(id, {
        claimStatus: 'verified',
        description: {
          text: 'A silk burial shroud woven in the highlands.',
          claimStatus: 'verified',
        },
      });

      const afterDescription = await service.update(OWNER, id, {
        description: 'New text.',
      });
      expect(afterDescription.claims).toEqual({
        item: 'verified',
        description: 'unreviewed',
      });

      const afterAuthor = await service.update(OWNER, id, {
        creatorName: 'Rakoto',
      });
      expect(afterAuthor.creatorName).toBe('Rakoto');
      expect(afterAuthor.claims.item).toBe('unreviewed');
    });

    it('keeps claims when only the rights change', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { claimStatus: 'verified' });

      const item = await service.update(OWNER, id, {
        rightsStatement: 'CC BY 4.0',
      });
      expect(item.rights.statement).toBe('CC BY 4.0');
      expect(item.claims.item).toBe('verified');
    });

    it('treats an identical value as no change', async () => {
      const { id, updatedAt } = await submit();
      repository.patchRecord(id, { claimStatus: 'verified' });

      const item = await service.update(OWNER, id, { title: 'Lamba mena' });
      expect(item.claims.item).toBe('verified');
      expect(item.updatedAt).toBe(updatedAt);
    });

    it('requires a signed-in caller', async () => {
      const { id } = await submit();

      await expect(
        service.update(GUEST, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    });

    it('hides the draft from another user and forbids reviewers to edit', async () => {
      const { id } = await submit();

      await expect(
        service.update(OTHER, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(
        service.update(REVIEWER, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('refuses to edit a published item', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { publicationStatus: 'published' });

      await expect(
        service.update(OWNER, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'ITEM_PUBLISHED',
      });
      await expect(
        service.update(OTHER, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('allows editing an unpublished item', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { publicationStatus: 'unpublished' });

      await expect(
        service.update(OWNER, id, { period: null }),
      ).resolves.toMatchObject({
        period: null,
      });
    });

    it('reports a conflict when the item is published during the edit', async () => {
      const { id } = await submit();
      jest.spyOn(repository, 'updateUnpublished').mockResolvedValueOnce(null);

      await expect(
        service.update(OWNER, id, { title: 'x' }),
      ).rejects.toMatchObject({
        code: 'ITEM_PUBLISHED',
      });
    });
  });

  /** Marks both claims reviewed, as CONTENT-04 will. */
  function review(id: string): void {
    const current = repository.items.get(id);
    if (current === undefined) throw new Error('missing item');
    repository.patchRecord(id, {
      claimStatus: 'verified',
      description: { ...current.description, claimStatus: 'uncertain' },
    });
  }

  const list = (caller: Parameters<ItemsService['list']>[0], query = {}) =>
    service.list(caller, parseOrThrow(listItemsQuerySchema, query));

  describe('publish', () => {
    it('publishes a reviewed draft and records the reviewer', async () => {
      const { id } = await submit();
      review(id);

      const item = await service.decide(REVIEWER, id, {
        decision: 'publish',
        note: 'Sources checked',
      });

      expect(item).toMatchObject({
        publicationStatus: 'published',
        submissionStatus: 'accepted',
        claims: { item: 'verified', description: 'uncertain' },
      });
      expect(item.publishedAt).not.toBeNull();
      expect(repository.events).toEqual([
        {
          itemId: id,
          action: 'publish',
          actorId: REVIEWER_ID,
          note: 'Sources checked',
        },
      ]);
      await expect(service.get(GUEST, id)).resolves.toMatchObject({ id });
    });

    it('is idempotent once published', async () => {
      const { id } = await submit();
      review(id);
      const first = await service.publish(REVIEWER, id, '');

      const second = await service.publish(REVIEWER, id, '');
      expect(second.publishedAt).toBe(first.publishedAt);
      expect(repository.events).toHaveLength(1);
    });

    it('requires both claims reviewed (D18)', async () => {
      const { id } = await submit();

      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'CLAIMS_UNREVIEWED',
      });
      expect(repository.items.get(id)?.publicationStatus).toBe('draft');
    });

    it('requires confirmed rights (D18)', async () => {
      const { id } = await service.create(
        OWNER,
        parseOrThrow(createItemSchema, createBody({ rightsConfirmed: false })),
      );
      review(id);

      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'RIGHTS_NOT_CONFIRMED',
      });
    });

    it.each([
      ['a guest', GUEST, 'UNAUTHENTICATED'],
      ['the owner', OWNER, 'FORBIDDEN'],
      ['another user', OTHER, 'FORBIDDEN'],
    ])('refuses %s', async (_name, caller, code) => {
      const { id } = await submit();
      review(id);

      await expect(service.publish(caller, id, '')).rejects.toMatchObject({
        code,
      });
    });

    it('forbids a reviewer to publish their own item', async () => {
      const { id } = await service.create(
        REVIEWER,
        parseOrThrow(createItemSchema, createBody()),
      );
      review(id);

      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('answers NOT_FOUND for an unknown item', async () => {
      await expect(
        service.publish(REVIEWER, '00000000-0000-4000-8000-000000000000', ''),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('leaves return and reject to the review workflow', async () => {
      const { id } = await submit();

      await expect(
        service.decide(REVIEWER, id, { decision: 'return', note: '' }),
      ).rejects.toMatchObject({ code: 'DECISION_NOT_AVAILABLE' });
      await expect(
        service.decide(OTHER, id, { decision: 'reject', note: '' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('unpublish and republish', () => {
    it('hides the item again and needs a new review after an edit', async () => {
      const { id } = await submit();
      review(id);
      await service.publish(REVIEWER, id, '');

      const unpublished = await service.unpublish(REVIEWER, id, {
        note: 'Rights dispute',
      });
      expect(unpublished.publicationStatus).toBe('unpublished');
      expect(unpublished.publishedAt).not.toBeNull();
      await expect(service.get(GUEST, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      await service.update(OWNER, id, { description: 'Corrected.' });
      await expect(service.publish(REVIEWER, id, '')).rejects.toMatchObject({
        code: 'CLAIMS_UNREVIEWED',
      });

      review(id);
      await expect(service.publish(REVIEWER, id, '')).resolves.toMatchObject({
        publicationStatus: 'published',
      });
      expect(repository.events.map((event) => event.action)).toEqual([
        'publish',
        'unpublish',
        'publish',
      ]);
    });

    it('refuses to unpublish a draft and non-reviewers', async () => {
      const { id } = await submit();

      await expect(
        service.unpublish(REVIEWER, id, { note: '' }),
      ).rejects.toMatchObject({ code: 'ITEM_NOT_PUBLISHED' });
      await expect(
        service.unpublish(OWNER, id, { note: '' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('list', () => {
    it('shows guests published items only, newest first', async () => {
      const first = await submit();
      const second = await submit();
      await submit();
      repository.patchRecord(first.id, { publicationStatus: 'published' });
      repository.patchRecord(second.id, { publicationStatus: 'published' });

      const page = await list(GUEST);
      expect(page.items.map((item) => item.id)).toEqual([second.id, first.id]);
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).toEqual({
        id: second.id,
        title: 'Lamba mena',
        kind: 'textile',
        creatorName: 'Rasoa',
        origin: 'Arivonimamo',
        period: 'Early 20th century',
        thumbnailUrl: null,
        publicationStatus: 'published',
        submissionStatus: 'in_review',
        claims: { item: 'unreviewed', description: 'unreviewed' },
        updatedAt: expect.any(String) as string,
      });
    });

    it('pages with a cursor without gaps or repeats, ties broken by id', async () => {
      const ids: string[] = [];
      for (let index = 0; index < 5; index += 1) {
        const { id } = await submit();
        ids.push(id);
        // Same creation time for all: the order falls back to the ID.
        repository.patchRecord(id, {
          publicationStatus: 'published',
          createdAt: new Date('2026-11-22T09:00:00.000Z'),
        });
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page = await list(GUEST, {
          limit: '2',
          ...(cursor === null ? {} : { cursor }),
        });
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      } while (cursor !== null);

      expect(seen).toEqual([...ids].sort().reverse());
    });

    it('filters by kind and by text in the title or author name', async () => {
      const { id } = await submit();
      const other = await service.create(
        OWNER,
        parseOrThrow(
          createItemSchema,
          createBody({ title: 'Sobika', kind: 'object', creatorName: 'Rabe' }),
        ),
      );
      repository.patchRecord(id, { publicationStatus: 'published' });
      repository.patchRecord(other.id, { publicationStatus: 'published' });

      const byKind = await list(GUEST, { kind: 'object' });
      expect(byKind.items.map((item) => item.id)).toEqual([other.id]);
      const byAuthor = await list(GUEST, { q: 'RASOA' });
      expect(byAuthor.items.map((item) => item.id)).toEqual([id]);
      const byTitle = await list(GUEST, { q: 'sobi' });
      expect(byTitle.items.map((item) => item.id)).toEqual([other.id]);
    });

    it('lists every own item for scope=mine and requires a session', async () => {
      const { id } = await submit();
      repository.patchRecord(id, { publicationStatus: 'unpublished' });

      const mine = await list(OWNER, { scope: 'mine' });
      expect(mine.items.map((item) => item.id)).toEqual([id]);
      await expect(list(OTHER, { scope: 'mine' })).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
      await expect(list(GUEST, { scope: 'mine' })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    });

    it('lists submissions in review oldest first, without the reviewer own', async () => {
      const older = await submit();
      const newer = await submit();
      const accepted = await submit();
      repository.patchRecord(accepted.id, { submissionStatus: 'accepted' });
      await service.create(
        REVIEWER,
        parseOrThrow(createItemSchema, createBody()),
      );

      const queue = await list(REVIEWER, { scope: 'review' });
      expect(queue.items.map((item) => item.id)).toEqual([older.id, newer.id]);

      const otherReviewer = callerOf(OTHER.userId, ['reviewer']);
      const all = await list(otherReviewer, { scope: 'review' });
      expect(all.items).toHaveLength(3);
    });

    it('protects the review queue', async () => {
      await expect(list(GUEST, { scope: 'review' })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
      await expect(list(OWNER, { scope: 'review' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('rejects a cursor from another scope', async () => {
      await submit();
      await submit();
      const mine = await list(OWNER, { scope: 'mine', limit: '1' });
      expect(mine.nextCursor).not.toBeNull();

      await expect(
        list(GUEST, { cursor: mine.nextCursor ?? '' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('publication lookup', () => {
    it('returns the status of any item to NFT and LiDAR', async () => {
      const { id } = await submit();

      await expect(service.publication('nft', id)).resolves.toEqual({
        contentId: id,
        publicationStatus: 'draft',
      });
      repository.patchRecord(id, { publicationStatus: 'published' });
      await expect(service.publication('lidar', id)).resolves.toEqual({
        contentId: id,
        publicationStatus: 'published',
      });
    });

    it('answers NOT_FOUND to the gateway and for unknown items', async () => {
      const { id } = await submit();

      await expect(service.publication('gateway', id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(
        service.publication('nft', '00000000-0000-4000-8000-000000000000'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
