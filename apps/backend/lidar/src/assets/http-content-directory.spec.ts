import { describe, expect, it, vi } from 'vitest';
import { ContentDirectoryUnavailableError } from './content-directory.js';
import {
  type FetchFunction,
  HttpContentDirectory,
} from './http-content-directory.js';

const CONTENT_ID = '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10';

function directoryReturning(fetch: FetchFunction): HttpContentDirectory {
  return new HttpContentDirectory({
    baseUrl: 'http://content:3000',
    timeoutMs: 1000,
    fetch,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HttpContentDirectory', () => {
  it('requests the content item by encoded id', async () => {
    const fetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse({ status: 'published' }));

    await directoryReturning(fetch).isPublished(CONTENT_ID);

    expect(fetch).toHaveBeenCalledWith(
      `http://content:3000/contents/${CONTENT_ID}`,
      expect.any(Object),
    );
  });

  it('reports published content', async () => {
    const directory = directoryReturning(() =>
      Promise.resolve(jsonResponse({ status: 'published' })),
    );
    await expect(directory.isPublished(CONTENT_ID)).resolves.toBe(true);
  });

  it('reports unpublished content', async () => {
    const directory = directoryReturning(() =>
      Promise.resolve(jsonResponse({ status: 'draft' })),
    );
    await expect(directory.isPublished(CONTENT_ID)).resolves.toBe(false);
  });

  it('reports unknown content on 404', async () => {
    const directory = directoryReturning(() =>
      Promise.resolve(jsonResponse({}, 404)),
    );
    await expect(directory.isPublished(CONTENT_ID)).resolves.toBe(false);
  });

  it.each([
    ['a server error', () => Promise.resolve(jsonResponse({}, 500))],
    [
      'an unexpected body',
      () => Promise.resolve(jsonResponse({ published: true })),
    ],
    [
      'invalid JSON',
      () => Promise.resolve(new Response('not json', { status: 200 })),
    ],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
  ])('fails explicitly on %s', async (_case, fetch: FetchFunction) => {
    await expect(
      directoryReturning(fetch).isPublished(CONTENT_ID),
    ).rejects.toBeInstanceOf(ContentDirectoryUnavailableError);
  });
});
