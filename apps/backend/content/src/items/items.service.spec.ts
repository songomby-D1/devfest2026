import { InMemoryItemRepository } from '../../test/support/in-memory-item-repository';
import {
  GUEST,
  OTHER,
  OWNER,
  OWNER_ID,
  REVIEWER,
  createBody,
} from '../../test/support/fixtures';
import { parseOrThrow } from '../common/zod-validation';
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
});
