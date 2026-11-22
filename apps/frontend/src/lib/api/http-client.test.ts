import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { createHttpClient } from './http-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createHttpClient', () => {
  it('calls the gateway routes under /api and encodes the id', async () => {
    const fetchImpl = vi.fn((_input: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse(200, {})),
    );
    const client = createHttpClient(fetchImpl);
    await client.listItems();
    await client.getItem('a/b');
    await client.getProvenance('id-1');
    await client.getModel3d('id-1');
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      '/api/items',
      '/api/items/a%2Fb',
      '/api/items/id-1/provenance',
      '/api/items/id-1/model3d',
    ]);
  });

  it('sends the mandatory idempotency key on mint and reports 202 as created', async () => {
    const mint = { mintId: 'm1', contentId: 'id-1', status: 'pending' };
    const fetchImpl = vi.fn((_input: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse(202, mint)),
    );
    const result = await createHttpClient(fetchImpl).mintItem('id-1', 'k-42');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('/api/items/id-1/mint');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('k-42');
    expect(result).toEqual({ created: true, mint });
  });

  it('reports a replayed mint key (200) as not created', async () => {
    const mint = { mintId: 'm1', contentId: 'id-1', status: 'confirmed' };
    const client = createHttpClient(() =>
      Promise.resolve(jsonResponse(200, mint)),
    );
    expect(await client.mintItem('id-1', 'k-42')).toEqual({
      created: false,
      mint,
    });
  });

  it('normalizes the 3D descriptor', async () => {
    const client = createHttpClient(() =>
      Promise.resolve(jsonResponse(200, { contentId: 'id-1', status: 'none' })),
    );
    expect(await client.getModel3d('id-1')).toEqual({
      contentId: 'id-1',
      status: 'missing',
      variants: null,
    });
  });

  it('posts the review as JSON', async () => {
    const fetchImpl = vi.fn((_input: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse(200, {})),
    );
    const decision = { item: 'verified', description: 'uncertain' } as const;
    await createHttpClient(fetchImpl).reviewItem('id-1', decision);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.body).toBe(JSON.stringify(decision));
  });

  it('turns a public error body into an ApiError', async () => {
    const body = {
      code: 'FORBIDDEN',
      message: 'Accès refusé.',
      requestId: 'r1',
    };
    const client = createHttpClient(() =>
      Promise.resolve(jsonResponse(403, body)),
    );
    await expect(client.getItem('x')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Accès refusé.',
      requestId: 'r1',
    });
  });

  it('never exposes a malformed error body', async () => {
    const client = createHttpClient(() =>
      Promise.resolve(
        new Response('<html>stack trace</html>', { status: 502 }),
      ),
    );
    const error: unknown = await client.listItems().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
    expect((error as ApiError).message).not.toContain('stack');
  });
});
