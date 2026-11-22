import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { createHttpClient, itemListSearch } from './http-client';
import type { UploadTransport } from './http-client';

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
    await client.listItems({ scope: 'mine', cursor: 'c/1', limit: 50, q: '' });
    await client.getItem('a/b');
    await client.me();
    await client.getProvenance('id-1');
    await client.getModel3d('id-1');
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      '/api/items',
      '/api/items?scope=mine&cursor=c%2F1&limit=50',
      '/api/items/a%2Fb',
      '/api/auth/me',
      '/api/items/id-1/provenance',
      '/api/items/id-1/model3d',
    ]);
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe('same-origin');
  });

  it('builds the list query from the defined filters only', () => {
    expect(itemListSearch({ kind: 'textile', q: 'lamba' })).toBe(
      '?kind=textile&q=lamba',
    );
    expect(itemListSearch({})).toBe('');
  });

  it('posts sign-in, the review and the decision as JSON, and logs out without a body', async () => {
    const fetchImpl = vi.fn((input: string, _init?: RequestInit) =>
      Promise.resolve(
        input.endsWith('/logout')
          ? new Response(null, { status: 204 })
          : jsonResponse(200, {}),
      ),
    );
    const client = createHttpClient(fetchImpl);
    const review = {
      target: 'item',
      outcome: 'verified',
      rationale: 'Conforme.',
      evidence: ['Archive'],
    } as const;
    await client.login({ email: 'a@b.c', password: 'p' });
    await client.reviewItem('id-1', review);
    await client.decideItem('id-1', {
      decision: 'return',
      note: 'Photo floue.',
    });
    await client.logout();
    const calls = fetchImpl.mock.calls;
    expect(calls.map((call) => [call[0], call[1]?.method])).toEqual([
      ['/api/auth/login', 'POST'],
      ['/api/items/id-1/review', 'POST'],
      ['/api/items/id-1/decision', 'POST'],
      ['/api/auth/logout', 'POST'],
    ]);
    expect(calls[1]?.[1]?.body).toBe(JSON.stringify(review));
    expect(calls[2]?.[1]?.body).toBe(
      JSON.stringify({ decision: 'return', note: 'Photo floue.' }),
    );
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

  it('uploads the caption and the file as multipart through the upload transport', async () => {
    const upload = vi.fn<UploadTransport>((_url, _body, options) => {
      options.onProgress?.(0.5);
      return Promise.resolve({
        status: 201,
        body: { id: 'm1', kind: 'image' },
      });
    });
    const progress = vi.fn();
    const client = createHttpClient(
      () => Promise.reject(new Error('unused')),
      '/api',
      upload,
    );
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const media = await client.uploadMedia('id-1', file, {
      caption: ' Légende ',
      onProgress: progress,
    });

    const [url, body] = upload.mock.calls[0] ?? [];
    expect(url).toBe('/api/items/id-1/media');
    expect([...(body?.keys() ?? [])]).toEqual(['caption', 'file']);
    expect(body?.get('caption')).toBe('Légende');
    expect(progress).toHaveBeenCalledWith(0.5);
    expect(media).toMatchObject({ id: 'm1' });
  });

  it('turns an upload refusal into an ApiError', async () => {
    const upload: UploadTransport = () =>
      Promise.resolve({
        status: 413,
        body: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Too large',
          requestId: 'r9',
        },
      });
    const client = createHttpClient(
      () => Promise.reject(new Error('unused')),
      '/api',
      upload,
    );
    await expect(
      client.uploadMedia('id-1', new Blob(['x'])),
    ).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      requestId: 'r9',
    });
  });

  it('turns a public error body into an ApiError with its details', async () => {
    const body = {
      code: 'VALIDATION_FAILED',
      message: 'Invalid.',
      requestId: 'r1',
      details: [{ field: 'title', reason: 'must not be empty' }],
    };
    const client = createHttpClient(() =>
      Promise.resolve(jsonResponse(400, body)),
    );
    await expect(client.getItem('x')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      requestId: 'r1',
      details: body.details,
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

  it('reports a network failure as a public error', async () => {
    const client = createHttpClient(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    await expect(client.listItems()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});
