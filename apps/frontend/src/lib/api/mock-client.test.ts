import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { fixtureIds, fixtureItems } from './fixtures';
import { createMockClient } from './mock-client';

describe('mock fixtures', () => {
  it('cover every publication and claim status', () => {
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
