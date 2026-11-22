import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  OTHER_ID,
  OWNER_ID,
  REVIEWER_ID,
  createBody,
  testConfig,
} from '../support/fixtures';
import { InMemoryItemRepository } from '../support/in-memory-item-repository';
import { createTestApp, gatewayHeaders } from '../support/test-app';

const REVIEWER = gatewayHeaders(REVIEWER_ID, ['reviewer']);

const REVIEW = {
  target: 'item',
  outcome: 'verified',
  rationale: 'Matches the museum inventory card.',
  evidence: ['Inventory card 1932-14'],
};

describe('content-service HTTP: claim review (CONTENT-04)', () => {
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

  async function submit(ownerId = OWNER_ID): Promise<string> {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(ownerId))
      .send(createBody());
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  const review = (id: string, body: object, headers = REVIEWER) =>
    http().post(`/internal/v1/items/${id}/review`).set(headers).send(body);

  it('records an item review and answers 201 ItemDetail', async () => {
    const id = await submit();

    const response = await review(id, REVIEW);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id,
      claims: { item: 'verified', description: 'unreviewed' },
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      reviews: [
        {
          ...REVIEW,
          reviewerId: REVIEWER_ID,
          reviewedAt: expect.stringMatching(/Z$/) as string,
        },
      ],
    });
  });

  it('shows the claims and the latest review to the owner', async () => {
    const id = await submit();
    await review(id, {
      ...REVIEW,
      target: 'description',
      outcome: 'uncertain',
    });

    const owner = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID));

    expect(owner.status).toBe(200);
    expect(owner.body).toMatchObject({
      claims: { item: 'unreviewed', description: 'uncertain' },
      reviews: [{ target: 'description', outcome: 'uncertain' }],
    });
  });

  it('runs the whole flow: review both claims, then publish', async () => {
    const id = await submit();
    expect((await review(id, REVIEW)).status).toBe(201);
    expect(
      (await review(id, { ...REVIEW, target: 'description' })).status,
    ).toBe(201);

    const published = await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(REVIEWER)
      .send({ decision: 'publish', note: 'Both claims verified' });
    expect(published.status).toBe(200);

    const guest = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(null));
    expect(guest.status).toBe(200);
    expect(guest.body).toMatchObject({
      publicationStatus: 'published',
      claims: { item: 'verified', description: 'verified' },
    });
    expect((guest.body as { reviews: unknown[] }).reviews).toHaveLength(2);
  });

  it.each([
    [
      'an unknown target',
      { ...REVIEW, target: 'media' },
      'target',
      'must be one of item, description',
    ],
    [
      'an unreviewed outcome',
      { ...REVIEW, outcome: 'unreviewed' },
      'outcome',
      'must be one of verified, uncertain',
    ],
    [
      'a blank rationale',
      { ...REVIEW, rationale: '  ' },
      'rationale',
      'must not be empty',
    ],
    [
      'a missing evidence list',
      { target: 'item', outcome: 'verified', rationale: 'Ok' },
      'evidence',
      'must be an array of strings',
    ],
    [
      'an empty evidence entry',
      { ...REVIEW, evidence: [''] },
      'evidence.0',
      'must not be empty',
    ],
    [
      'too many evidence entries',
      { ...REVIEW, evidence: Array.from({ length: 21 }, () => 'Source') },
      'evidence',
      'must have at most 20 entries',
    ],
    [
      'an unknown field',
      { ...REVIEW, claimStatus: 'verified' },
      'claimStatus',
      'is not allowed',
    ],
  ])('answers 400 for %s', async (_name, body, field, reason) => {
    const id = await submit();

    const response = await review(id, body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: expect.any(String) as string,
      requestId: 'req-123',
      details: [{ field, reason }],
    });
    expect(repository.reviews).toHaveLength(0);
  });

  it.each([
    ['a guest', gatewayHeaders(null), 401, 'UNAUTHENTICATED'],
    ['the owner', gatewayHeaders(OWNER_ID), 403, 'FORBIDDEN'],
    ['another user', gatewayHeaders(OTHER_ID), 403, 'FORBIDDEN'],
  ])('refuses %s', async (_name, headers, status, code) => {
    const id = await submit();

    const response = await review(id, REVIEW, headers);

    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code, requestId: 'req-123' });
    expect(repository.items.get(id)?.claimStatus).toBe('unreviewed');
  });

  it('forbids a reviewer to review their own submission', async () => {
    const id = await submit(REVIEWER_ID);

    const response = await review(id, REVIEW);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('answers 422 for a submission that is not in review', async () => {
    const id = await submit();
    await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(REVIEWER)
      .send({ decision: 'return', note: 'Fix the title' });

    const response = await review(id, REVIEW);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'SUBMISSION_NOT_IN_REVIEW',
      requestId: 'req-123',
    });
  });

  it('answers 404 for an unknown item and 400 for a bad ID', async () => {
    const unknown = await review(
      '00000000-0000-4000-8000-000000000000',
      REVIEW,
    );
    expect(unknown.status).toBe(404);

    const bad = await review('not-a-uuid', REVIEW);
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({
      details: [{ field: 'id', reason: 'must be a UUID' }],
    });
  });

  it('answers 409 SUBMISSION_REJECTED to an edit of a rejected item', async () => {
    const id = await submit();
    await http()
      .post(`/internal/v1/items/${id}/decision`)
      .set(REVIEWER)
      .send({ decision: 'reject', note: 'Not a cultural item' });

    const response = await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ title: 'Again' });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'SUBMISSION_REJECTED' });
  });
});
