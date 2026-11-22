import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { fixtureIds, fixtureItems, fixtureModels } from './fixtures';
import { createMockClient } from './mock-client';

describe('mock fixtures', () => {
  it('cover every publication, claim and 3D status', () => {
    expect(new Set(fixtureItems.map((i) => i.publicationStatus))).toEqual(
      new Set(['draft', 'published', 'unpublished']),
    );
    const claims = fixtureItems.flatMap((i) => [
      i.claims.item,
      i.claims.description,
    ]);
    expect(new Set(claims)).toEqual(
      new Set(['unreviewed', 'verified', 'uncertain']),
    );
    expect(new Set(fixtureModels.map((m) => m.status))).toEqual(
      new Set(['ready', 'processing', 'missing']),
    );
  });

  it('give variants only to ready models', () => {
    for (const model of fixtureModels) {
      expect(model.variants !== undefined).toBe(model.status === 'ready');
    }
  });
});

describe('createMockClient', () => {
  it('lists only published items', async () => {
    const { items } = await createMockClient().listItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.publicationStatus === 'published')).toBe(true);
  });

  it('rejects an unknown id with the public error shape', async () => {
    const error: unknown = await createMockClient()
      .getItem('unknown')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect((error as ApiError).requestId).not.toBe('');
  });

  it('creates a draft item with unreviewed claims', async () => {
    const client = createMockClient({ createId: () => 'new-id' });
    const item = await client.createItem({ title: 'T', description: 'D' });
    expect(item).toMatchObject({
      id: 'new-id',
      publicationStatus: 'draft',
      claims: { item: 'unreviewed', description: 'unreviewed' },
    });
    await expect(client.getItem('new-id')).resolves.toEqual(item);
  });

  it('records the item and description reviews separately', async () => {
    const client = createMockClient();
    const item = await client.reviewItem(fixtureIds.textile, {
      item: 'verified',
      description: 'uncertain',
    });
    expect(item.claims).toEqual({ item: 'verified', description: 'uncertain' });
  });

  it('mints idempotently and confirms on the next provenance read', async () => {
    const client = createMockClient();
    const first = await client.mintItem(fixtureIds.textile, 'key-1');
    const retry = await client.mintItem(fixtureIds.textile, 'key-1');
    expect(first).toEqual({ contentId: fixtureIds.textile, status: 'pending' });
    expect(retry).toEqual(first);
    const provenance = await client.getProvenance(fixtureIds.textile);
    expect(provenance.mint).toBe('confirmed');
  });

  it('reports a missing model for an item without a 3D record', async () => {
    const model = await createMockClient().getModel3d(fixtureIds.draft);
    expect(model).toEqual({ contentId: fixtureIds.draft, status: 'missing' });
  });

  it('isolates state between clients and from returned objects', async () => {
    const a = createMockClient();
    const item = await a.getItem(fixtureIds.sculpture);
    item.title = 'changed';
    await a.reviewItem(fixtureIds.sculpture, {
      item: 'uncertain',
      description: 'uncertain',
    });
    const fromA = await a.getItem(fixtureIds.sculpture);
    const fromB = await createMockClient().getItem(fixtureIds.sculpture);
    expect(fromA.title).not.toBe('changed');
    expect(fromB.claims.item).toBe('verified');
  });
});
