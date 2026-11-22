import { describe, expect, it } from 'vitest';
import { fixtureIds } from './fixtures';
import { createMockClient } from './mock-client';
import {
  fixtureModels,
  fixtureProvenance,
  provenanceFixtureIds,
} from './provenance-fixtures';

const KEY = 'test-key-0000000001';

describe('provenance fixtures', () => {
  it('cover every 3D status, with variants only when ready', () => {
    expect(new Set(fixtureModels.map((m) => m.status))).toEqual(
      new Set(['ready', 'processing', 'missing']),
    );
    for (const model of fixtureModels) {
      expect(model.variants !== null).toBe(model.status === 'ready');
    }
  });

  it('cover no mint, every mint status and every verification state', () => {
    const mints = fixtureProvenance.map((p) => p.mint);
    expect(mints).toContain(null);
    expect(new Set(mints.map((m) => m?.status))).toEqual(
      new Set([undefined, 'pending', 'confirmed', 'failed']),
    );
    expect(new Set(mints.map((m) => m?.verification?.state))).toEqual(
      new Set([undefined, 'verified', 'mismatch', 'unverifiable']),
    );
  });

  it('follow the MintRecord shape of packages/shared', () => {
    for (const { mint } of fixtureProvenance) {
      if (mint === null) continue;
      expect(Object.keys(mint)).toEqual(
        expect.arrayContaining([
          'mintId',
          'contentId',
          'status',
          'network',
          'tokenId',
          'transactionHash',
          'explorerUrl',
          'failureReason',
          'requestedAt',
          'confirmedAt',
        ]),
      );
    }
  });
});

describe('mock mint and provenance', () => {
  it('accepts a mint (created), replays the same key and confirms after one pending read', async () => {
    const client = createMockClient();
    const first = await client.mintItem(fixtureIds.textile, KEY);
    const retry = await client.mintItem(fixtureIds.textile, KEY);
    expect(first.created).toBe(true);
    expect(first.mint).toMatchObject({
      contentId: fixtureIds.textile,
      status: 'pending',
    });
    expect(retry.created).toBe(false);
    expect(retry.mint.mintId).toBe(first.mint.mintId);

    expect((await client.getProvenance(fixtureIds.textile)).mint?.status).toBe(
      'pending',
    );
    const confirmed = await client.getProvenance(fixtureIds.textile);
    expect(confirmed.mint).toMatchObject({
      status: 'confirmed',
      verification: { state: 'verified', fixity: true },
    });
  });

  it('answers 409 for a new key on an item with a live or confirmed mint', async () => {
    const client = createMockClient();
    await expect(
      client.mintItem(fixtureIds.sculpture, KEY),
    ).rejects.toMatchObject({ status: 409, code: 'MINT_ALREADY_REQUESTED' });
  });

  it('lets a failed mint be requested again with a new key', async () => {
    const result = await createMockClient().mintItem(fixtureIds.painting, KEY);
    expect(result).toMatchObject({ created: true, mint: { status: 'pending' } });
  });

  it('answers 422 for a key reused on another item and 400 for a bad key', async () => {
    const client = createMockClient();
    await client.mintItem(fixtureIds.textile, KEY);
    await expect(
      client.mintItem(fixtureIds.painting, KEY),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      client.mintItem(fixtureIds.painting, 'short'),
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('answers the same 404 for draft, unpublished and unknown items', async () => {
    const client = createMockClient();
    for (const id of [fixtureIds.draft, fixtureIds.unpublished, 'unknown']) {
      await expect(client.getProvenance(id)).rejects.toMatchObject({
        status: 404,
      });
    }
  });

  it('serves provenance-only fixtures', async () => {
    const provenance = await createMockClient().getProvenance(
      provenanceFixtureIds.mismatch,
    );
    expect(provenance.mint?.verification?.state).toBe('mismatch');
  });

  it('reports a missing model for an item without a 3D record', async () => {
    const model = await createMockClient().getModel3d(fixtureIds.draft);
    expect(model).toEqual({
      contentId: fixtureIds.draft,
      status: 'missing',
      variants: null,
    });
  });
});
