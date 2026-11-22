import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  NFT_TOKEN,
  OTHER_ID,
  OWNER_ID,
  REVIEWER_ID,
  createBody,
  testConfig,
} from '../support/fixtures';
import { InMemoryItemRepository } from '../support/in-memory-item-repository';
import { createTestApp, gatewayHeaders } from '../support/test-app';

const REVIEWER = gatewayHeaders(REVIEWER_ID, ['reviewer']);

function nftHeaders(): Record<string, string> {
  return {
    'x-service-name': 'nft',
    'x-service-token': NFT_TOKEN,
    'x-request-id': 'req-nft',
  };
}

describe('content-service HTTP: publication and listing (CONTENT-02)', () => {
  let app: NestExpressApplication;
  let repository: InMemoryItemRepository;

  beforeEach(async () => {
    repository = new InMemoryItemRepository();
    app = await createTestApp(testConfig(), repository);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function submit(body = createBody()): Promise<string> {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(body);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  function review(id: string): void {
    const current = repository.items.get(id);
    if (current === undefined) throw new Error('missing item');
    repository.patchRecord(id, {
      claimStatus: 'verified',
      description: { ...current.description, claimStatus: 'verified' },
    });
  }

  describe('POST /internal/v1/items/{id}/decision', () => {
    it('publishes a reviewed item and makes it public', async () => {
      const id = await submit();
      review(id);

      const response = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'publish', note: 'Both claims reviewed' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id,
        publicationStatus: 'published',
        submissionStatus: 'accepted',
        publishedAt: expect.any(String) as string,
        isOwner: false,
      });
      const guest = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(null));
      expect(guest.status).toBe(200);
    });

    it('answers 422 with the rule code when claims are unreviewed', async () => {
      const id = await submit();

      const response = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'publish', note: '' });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        code: 'CLAIMS_UNREVIEWED',
        message:
          'Both the item claims and the description claims must be reviewed first',
        requestId: 'req-123',
      });
    });

    it.each([
      ['a guest', gatewayHeaders(null), 401, 'UNAUTHENTICATED'],
      ['the owner', gatewayHeaders(OWNER_ID), 403, 'FORBIDDEN'],
      ['a non-reviewer', gatewayHeaders(OTHER_ID), 403, 'FORBIDDEN'],
    ])('refuses %s', async (_name, headers, status, code) => {
      const id = await submit();
      review(id);

      const response = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(headers)
        .send({ decision: 'publish', note: '' });

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ code });
      expect(repository.items.get(id)?.publicationStatus).toBe('draft');
    });

    it('validates the body and the ID', async () => {
      const id = await submit();

      const body = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'approve', note: 'x'.repeat(4001), extra: true });
      expect(body.status).toBe(400);
      expect(body.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'decision' }),
          expect.objectContaining({ field: 'note' }),
          { field: 'extra', reason: 'is not allowed' },
        ]) as unknown,
      });

      const badId = await http()
        .post('/internal/v1/items/not-a-uuid/decision')
        .set(REVIEWER)
        .send({ decision: 'publish', note: '' });
      expect(badId.status).toBe(400);

      const unknown = await http()
        .post(
          '/internal/v1/items/00000000-0000-4000-8000-000000000000/decision',
        )
        .set(REVIEWER)
        .send({ decision: 'publish', note: '' });
      expect(unknown.status).toBe(404);
    });

    it('returns and rejects a submission (CONTENT-04)', async () => {
      const id = await submit();

      const returned = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'return', note: 'Add the period' });
      expect(returned.status).toBe(200);
      expect(returned.body).toMatchObject({ submissionStatus: 'returned' });

      const rejected = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'reject', note: 'Out of scope' });
      expect(rejected.status).toBe(200);
      expect(rejected.body).toMatchObject({ submissionStatus: 'rejected' });
    });

    it('needs a note to return or reject', async () => {
      const id = await submit();

      const response = await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'reject', note: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: 'VALIDATION_FAILED',
        message: expect.any(String) as string,
        requestId: 'req-123',
        details: [
          { field: 'note', reason: 'must not be empty for return or reject' },
        ],
      });
    });
  });

  describe('POST /internal/v1/items/{id}/unpublish', () => {
    it('takes a published item out of public browsing', async () => {
      const id = await submit();
      review(id);
      await http()
        .post(`/internal/v1/items/${id}/decision`)
        .set(REVIEWER)
        .send({ decision: 'publish', note: '' })
        .expect(200);

      const response = await http()
        .post(`/internal/v1/items/${id}/unpublish`)
        .set(REVIEWER)
        .send({ note: 'Rights dispute' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ publicationStatus: 'unpublished' });

      const listed = await http()
        .get('/internal/v1/items')
        .set(gatewayHeaders(null));
      expect(listed.body).toEqual({ items: [], nextCursor: null });
      const guest = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(null));
      expect(guest.status).toBe(404);
    });

    it('answers 409 for a draft and 403 for a non-reviewer', async () => {
      const id = await submit();

      const draft = await http()
        .post(`/internal/v1/items/${id}/unpublish`)
        .set(REVIEWER)
        .send({ note: '' });
      expect(draft.status).toBe(409);
      expect(draft.body).toMatchObject({ code: 'ITEM_NOT_PUBLISHED' });

      const owner = await http()
        .post(`/internal/v1/items/${id}/unpublish`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ note: '' });
      expect(owner.status).toBe(403);
    });
  });

  describe('GET /internal/v1/items', () => {
    it('lists published items for guests with a cursor', async () => {
      const ids = [await submit(), await submit(), await submit()];
      await submit(); // stays a draft
      for (const id of ids) {
        repository.patchRecord(id, { publicationStatus: 'published' });
      }

      const first = await http()
        .get('/internal/v1/items?limit=2')
        .set(gatewayHeaders(null));
      expect(first.status).toBe(200);
      const firstPage = first.body as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      expect(firstPage.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);
      expect(firstPage.nextCursor).toEqual(expect.any(String));

      const second = await http()
        .get('/internal/v1/items')
        .query({ limit: 2, cursor: firstPage.nextCursor })
        .set(gatewayHeaders(null));
      expect(second.body).toEqual({
        items: [expect.objectContaining({ id: ids[0] })],
        nextCursor: null,
      });
    });

    it('answers 400 for an invalid query', async () => {
      const response = await http()
        .get('/internal/v1/items?limit=500&scope=all&cursor=zzz')
        .set(gatewayHeaders(null));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'limit' }),
          expect.objectContaining({ field: 'scope' }),
        ]) as unknown,
      });
    });

    it('protects the mine and review scopes', async () => {
      await submit();

      const guestMine = await http()
        .get('/internal/v1/items?scope=mine')
        .set(gatewayHeaders(null));
      expect(guestMine.status).toBe(401);
      const userReview = await http()
        .get('/internal/v1/items?scope=review')
        .set(gatewayHeaders(OTHER_ID));
      expect(userReview.status).toBe(403);

      const mine = await http()
        .get('/internal/v1/items?scope=mine')
        .set(gatewayHeaders(OWNER_ID));
      expect((mine.body as { items: unknown[] }).items).toHaveLength(1);
      const queue = await http()
        .get('/internal/v1/items?scope=review')
        .set(REVIEWER);
      expect((queue.body as { items: unknown[] }).items).toHaveLength(1);
    });
  });

  describe('GET /internal/v1/items/{id}/publication', () => {
    it('returns the publication status to NFT', async () => {
      const id = await submit();

      const response = await http()
        .get(`/internal/v1/items/${id}/publication`)
        .set(nftHeaders());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        contentId: id,
        publicationStatus: 'draft',
      });
    });

    it('answers 404 to the gateway so drafts stay hidden', async () => {
      const id = await submit();

      const response = await http()
        .get(`/internal/v1/items/${id}/publication`)
        .set(gatewayHeaders(OWNER_ID));

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('refuses a caller without a configured secret', async () => {
      const id = await submit();

      const response = await http()
        .get(`/internal/v1/items/${id}/publication`)
        .set({ 'x-service-name': 'lidar', 'x-service-token': NFT_TOKEN });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAUTHENTICATED' });
    });

    it('answers 404 for an unknown item', async () => {
      const response = await http()
        .get(
          '/internal/v1/items/00000000-0000-4000-8000-000000000000/publication',
        )
        .set(nftHeaders());

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        code: 'NOT_FOUND',
        message: 'The item does not exist',
        requestId: 'req-nft',
      });
    });
  });
});
