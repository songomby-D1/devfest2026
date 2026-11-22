import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { fixtureIds, fixtureItems } from './fixtures';
import { createMockClient } from './mock-client';

const newItem = {
  title: 'T',
  kind: 'object',
  description: 'D',
  rightsStatement: 'CC0',
  rightsConfirmed: true,
} as const;

describe('mock fixtures', () => {
  it('cover every publication, submission and claim status', () => {
    const items = fixtureItems.map((entry) => entry.item);
    expect(new Set(items.map((i) => i.publicationStatus))).toEqual(
      new Set(['draft', 'published', 'unpublished']),
    );
    expect(new Set(items.map((i) => i.submissionStatus))).toEqual(
      new Set(['in_review', 'returned', 'accepted']),
    );
    const claims = items.flatMap((i) => [i.claims.item, i.claims.description]);
    expect(new Set(claims)).toEqual(
      new Set(['unreviewed', 'verified', 'uncertain']),
    );
  });

  it('never publish an item with an unreviewed claim (D18)', () => {
    for (const { item } of fixtureItems) {
      if (item.publicationStatus === 'published') {
        expect(item.claims.item).not.toBe('unreviewed');
        expect(item.claims.description).not.toBe('unreviewed');
      }
    }
  });
});

describe('createMockClient', () => {
  it('lists only published items as summaries for a guest, with a cursor', async () => {
    const client = createMockClient();
    const first = await client.listItems({ limit: 4 });
    expect(first.items).toHaveLength(4);
    expect(first.items.every((i) => i.publicationStatus === 'published')).toBe(
      true,
    );
    expect(first.items[0]).not.toHaveProperty('description');
    expect(first.nextCursor).not.toBeNull();
    const second = await client.listItems({
      limit: 4,
      cursor: first.nextCursor ?? '',
    });
    expect(second.nextCursor).toBeNull();
    expect(await client.listItems({ kind: 'sculpture' })).toMatchObject({
      items: [{ id: fixtureIds.sculpture }],
    });
  });

  it('scopes mine to the caller and review to reviewers', async () => {
    await expect(
      createMockClient().listItems({ scope: 'mine' }),
    ).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      createMockClient({ signedInAs: 'contributor' }).listItems({
        scope: 'review',
      }),
    ).rejects.toMatchObject({ status: 403 });
    const queue = await createMockClient({ signedInAs: 'reviewer' }).listItems({
      scope: 'review',
    });
    expect(queue.items.every((i) => i.submissionStatus === 'in_review')).toBe(
      true,
    );
  });

  it('hides drafts from guests with the public error shape', async () => {
    const error: unknown = await createMockClient()
      .getItem(fixtureIds.draft)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect((error as ApiError).requestId).not.toBe('');
  });

  it('creates a draft in review with unreviewed claims, owned by the caller', async () => {
    const client = createMockClient({
      signedInAs: 'contributor',
      createId: () => 'new-id',
    });
    const item = await client.createItem(newItem);
    expect(item).toMatchObject({
      id: 'new-id',
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      claims: { item: 'unreviewed', description: 'unreviewed' },
      isOwner: true,
      creatorName: null,
    });
    await expect(client.getItem('new-id')).resolves.toEqual(item);
    await expect(createMockClient().createItem(newItem)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('refuses unsupported or oversized media like the service', async () => {
    const client = createMockClient({ signedInAs: 'contributor' });
    await expect(
      client.uploadMedia(
        fixtureIds.draft,
        new File(['x'], 'a.gif', { type: 'image/gif' }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    const big = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'b.png', {
      type: 'image/png',
    });
    await expect(
      client.uploadMedia(fixtureIds.draft, big),
    ).rejects.toMatchObject({ status: 413 });
    const media = await client.uploadMedia(
      fixtureIds.draft,
      new File(['x'], 'c.png', { type: 'image/png' }),
      { caption: 'Face' },
    );
    expect(media).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      caption: 'Face',
    });
  });

  it('records the item and description reviews separately and refuses self-review', async () => {
    const client = createMockClient({ signedInAs: 'reviewer' });
    const item = await client.reviewItem(fixtureIds.draft, {
      target: 'description',
      outcome: 'uncertain',
      rationale: 'Usage non confirmé.',
      evidence: [],
    });
    expect(item.claims).toEqual({
      item: 'unreviewed',
      description: 'uncertain',
    });
    expect(item.reviews).toHaveLength(1);
    await expect(
      client.reviewItem(fixtureIds.reviewerOwn, {
        target: 'item',
        outcome: 'verified',
        rationale: 'x',
        evidence: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('applies the publication rules on decisions', async () => {
    const client = createMockClient({ signedInAs: 'reviewer' });
    await expect(
      client.decideItem(fixtureIds.draft, { decision: 'publish', note: '' }),
    ).rejects.toMatchObject({ status: 422, code: 'CLAIMS_UNREVIEWED' });
    await expect(
      client.decideItem(fixtureIds.draft, { decision: 'reject', note: '' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    const returned = await client.decideItem(fixtureIds.draft, {
      decision: 'return',
      note: 'Photo floue.',
    });
    expect(returned.submissionStatus).toBe('returned');
  });

  it('signs in fixture accounts and refuses wrong credentials', async () => {
    const client = createMockClient();
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    await expect(
      client.login({ email: 'relecteur@lova.test', password: 'short' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const me = await client.login({
      email: 'relecteur@lova.test',
      password: 'a-long-enough-phrase',
    });
    expect(me.permissions).toEqual(['reviewer']);
    await client.logout();
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
  });

  it('isolates state between clients and from returned objects', async () => {
    const a = createMockClient({ signedInAs: 'reviewer' });
    const item = await a.getItem(fixtureIds.draft);
    expect(item.title).toBe('Valiha');
    await a.reviewItem(fixtureIds.draft, {
      target: 'item',
      outcome: 'uncertain',
      rationale: 'x',
      evidence: [],
    });
    const fromA = await a.getItem(fixtureIds.draft);
    const fromB = await createMockClient({ signedInAs: 'reviewer' }).getItem(
      fixtureIds.draft,
    );
    expect(fromA.claims.item).toBe('uncertain');
    expect(fromB.claims.item).toBe('unreviewed');
  });
});
