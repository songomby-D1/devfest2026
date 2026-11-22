import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { ContentSnapshotClient } from './content-snapshot-client';

const ID = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'content-test-token';

describe('ContentSnapshotClient', () => {
  let server: Server;
  let handler: (res: ServerResponse) => void;
  let baseUrl: string;
  let headers: Record<string, string | string[] | undefined>;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    server = createServer((req, res) => {
      headers = req.headers;
      handler(res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  function client(token: string | undefined = TOKEN) {
    return new ContentSnapshotClient({
      baseUrl,
      token,
      timeoutMs: 200,
      mediaTimeoutMs: 200,
    });
  }

  function answer(status: number, body: unknown): void {
    handler = (res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
  }

  it('calls as the nft service without user headers', async () => {
    answer(404, {});

    await expect(client().getItem(ID, 'req-1')).resolves.toEqual({
      kind: 'not_found',
    });
    expect(headers['x-service-name']).toBe('nft');
    expect(headers['x-service-token']).toBe(TOKEN);
    expect(headers['x-request-id']).toBe('req-1');
    expect(headers['x-caller-user-id']).toBeUndefined();
  });

  it('is unavailable without a token, and makes no call', async () => {
    handler = () => {
      throw new Error('unexpected call');
    };
    await expect(client('').getItem(ID, 'r')).resolves.toEqual({
      kind: 'content_unavailable',
      reason: 'not_configured',
    });
  });

  it.each([
    [401, 'unauthenticated'],
    [400, 'rejected'],
    [500, 'upstream_error'],
  ])('maps HTTP %s to %s', async (status, reason) => {
    answer(status, {});
    await expect(client().getItem(ID, 'r')).resolves.toEqual({
      kind: 'content_unavailable',
      reason,
    });
  });

  it('rejects a detail of another item or with a missing field', async () => {
    answer(200, { id: ID, title: 'x' });
    await expect(client().getItem(ID, 'r')).resolves.toMatchObject({
      reason: 'invalid_response',
    });
  });

  it('times out', async () => {
    handler = () => undefined;
    await expect(client().getItem(ID, 'r')).resolves.toEqual({
      kind: 'content_unavailable',
      reason: 'timeout',
    });
  });

  it('reads the recorded sha256 from a strong ETag only', async () => {
    const sha = 'a'.repeat(64);
    for (const [etag, recorded] of [
      [`"${sha}"`, sha],
      [`W/"${sha}"`, null],
      ['"abc"', null],
    ] as const) {
      handler = (res) => {
        res.writeHead(200, { etag, 'content-type': 'image/png' });
        res.end('png');
      };
      const result = await client().openMedia(ID, MEDIA_ID, 'r');
      if (result.kind !== 'found') throw new Error('expected a media stream');
      expect(result.media.recordedSha256).toBe(recorded);
      await result.media.cancel();
    }
  });
});
