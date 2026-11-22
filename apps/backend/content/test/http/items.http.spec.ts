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

describe('content-service HTTP', () => {
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

  async function submit(): Promise<string> {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  it('GET /health answers without a service token', async () => {
    const response = await http().get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  describe('POST /internal/v1/items', () => {
    it('creates a draft and returns the ItemDetail shape', async () => {
      const response = await http()
        .post('/internal/v1/items')
        .set(gatewayHeaders(OWNER_ID))
        .send(createBody());

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
        title: 'Lamba mena',
        kind: 'textile',
        creatorName: 'Rasoa',
        origin: 'Arivonimamo',
        period: 'Early 20th century',
        thumbnailUrl: null,
        publicationStatus: 'draft',
        submissionStatus: 'in_review',
        claims: { item: 'unreviewed', description: 'unreviewed' },
        updatedAt: expect.any(String) as string,
        description: 'A silk burial shroud woven in the highlands.',
        creator: {
          name: 'Rasoa',
          community: 'Merina weavers',
          technique: 'Hand-woven silk',
        },
        rights: {
          statement: 'Photographed by the contributor, who holds the rights.',
          confirmed: true,
        },
        media: [],
        reviews: [],
        isOwner: true,
        advisorySignals: [],
        createdAt: expect.any(String) as string,
        publishedAt: null,
      });
    });

    it('answers 401 UNAUTHENTICATED for a guest', async () => {
      const response = await http()
        .post('/internal/v1/items')
        .set(gatewayHeaders(null))
        .send(createBody());

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Sign in to continue',
        requestId: 'req-123',
      });
    });

    it('answers 400 VALIDATION_FAILED with details and stores nothing', async () => {
      const response = await http()
        .post('/internal/v1/items')
        .set(gatewayHeaders(OWNER_ID))
        .send(createBody({ title: '', kind: 'vase' }));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        requestId: 'req-123',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'kind' }),
        ]) as unknown,
      });
      expect(repository.items.size).toBe(0);
    });

    it('answers 400 for malformed JSON without parser details', async () => {
      const response = await http()
        .post('/internal/v1/items')
        .set(gatewayHeaders(OWNER_ID))
        .set('content-type', 'application/json')
        .send('{"title":');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'The request was rejected',
        requestId: 'req-123',
      });
    });

    it('answers 401 SERVICE_UNAUTHENTICATED without a valid service token', async () => {
      const response = await http()
        .post('/internal/v1/items')
        .set({ ...gatewayHeaders(OWNER_ID), 'x-service-token': 'wrong' })
        .send(createBody());

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAUTHENTICATED' });
      expect(repository.items.size).toBe(0);
    });
  });

  describe('GET /internal/v1/items/:id', () => {
    it('shows a draft to its owner and to a reviewer', async () => {
      const id = await submit();

      const owner = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID));
      const reviewer = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(REVIEWER_ID, ['reviewer']));

      expect(owner.status).toBe(200);
      expect(owner.body).toMatchObject({ id, isOwner: true });
      expect(reviewer.status).toBe(200);
      expect(reviewer.body).toMatchObject({ id, isOwner: false });
    });

    it('answers 404 to a guest and to another user for a draft', async () => {
      const id = await submit();

      for (const headers of [gatewayHeaders(null), gatewayHeaders(OTHER_ID)]) {
        const response = await http()
          .get(`/internal/v1/items/${id}`)
          .set(headers);
        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          code: 'NOT_FOUND',
          message: 'The item does not exist',
          requestId: 'req-123',
        });
      }
    });

    it('shows a published item to a guest', async () => {
      const id = await submit();
      repository.patchRecord(id, { publicationStatus: 'published' });

      const response = await http()
        .get(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(null));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id,
        publicationStatus: 'published',
        isOwner: false,
      });
      expect(response.body).not.toHaveProperty('advisorySignals');
    });

    it('answers 400 for an ID that is not a UUID', async () => {
      const response = await http()
        .get('/internal/v1/items/not-a-uuid')
        .set(gatewayHeaders(OWNER_ID));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'id', reason: 'must be a UUID' }],
      });
    });

    it('accepts an NFT caller with its own token', async () => {
      const id = await submit();
      repository.patchRecord(id, { publicationStatus: 'published' });

      const response = await http()
        .get(`/internal/v1/items/${id}`)
        .set({ 'x-service-name': 'nft', 'x-service-token': NFT_TOKEN });

      expect(response.status).toBe(200);
    });

    it('rejects a malformed caller user ID as a service fault', async () => {
      const id = await submit();

      const response = await http()
        .get(`/internal/v1/items/${id}`)
        .set({
          ...gatewayHeaders(null),
          'x-caller-user-id': 'ana@example.org',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAUTHENTICATED' });
    });
  });

  describe('PATCH /internal/v1/items/:id', () => {
    it('lets the owner edit a draft', async () => {
      const id = await submit();

      const response = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ description: 'Updated description.', origin: null });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        description: 'Updated description.',
        origin: null,
        claims: { item: 'unreviewed', description: 'unreviewed' },
      });
    });

    it('answers 403 to a reviewer and 409 once published', async () => {
      const id = await submit();

      const reviewer = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(REVIEWER_ID, ['reviewer']))
        .send({ title: 'x' });
      expect(reviewer.status).toBe(403);
      expect(reviewer.body).toMatchObject({ code: 'FORBIDDEN' });

      repository.patchRecord(id, { publicationStatus: 'published' });
      const owner = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ title: 'x' });
      expect(owner.status).toBe(409);
      expect(owner.body).toMatchObject({ code: 'ITEM_PUBLISHED' });
    });

    it('rejects an empty or unknown-field patch', async () => {
      const id = await submit();

      const empty = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({});
      const status = await http()
        .patch(`/internal/v1/items/${id}`)
        .set(gatewayHeaders(OWNER_ID))
        .send({ publicationStatus: 'published' });

      expect(empty.status).toBe(400);
      expect(status.status).toBe(400);
      expect(status.body).toMatchObject({
        details: [{ field: 'publicationStatus', reason: 'is not allowed' }],
      });
    });
  });

  it('answers unknown routes with the public error shape', async () => {
    const response = await http()
      .get('/internal/v1/nothing')
      .set(gatewayHeaders(OWNER_ID));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The request was rejected',
      requestId: 'req-123',
    });
  });
});
