import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { ContentClient, type ContentClientOptions } from './content-client';

const TOKEN = 'nft-to-content-test';
const CONTENT_ID = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const REQUEST_ID = 'req-nft-02';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

interface Recorded {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
}

/** A local stand-in for Content, answering with the queued handlers in order. */
class FakeContent {
  readonly requests: Recorded[] = [];
  private readonly handlers: Handler[] = [];
  private readonly server: Server;

  constructor() {
    this.server = createServer((request, response) => {
      this.requests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
      });
      const handler = this.handlers.shift() ?? json(500, {});
      handler(request, response);
    });
  }

  reply(...handlers: Handler[]): void {
    this.handlers.push(...handlers);
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}

function json(status: number, body: unknown): Handler {
  return (_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
}

function text(status: number, body: string): Handler {
  return (_request, response) => {
    response.writeHead(status, { 'content-type': 'text/plain' });
    response.end(body);
  };
}

/** Never answers, so the client times out. */
const hang: Handler = () => undefined;

/** Closes the socket without an HTTP answer. */
const drop: Handler = (request) => {
  request.socket.destroy();
};

let fake: FakeContent;
let baseUrl: string;
let logs: string[];

beforeEach(async () => {
  fake = new FakeContent();
  baseUrl = await fake.start();
  logs = [];
  for (const level of ['log', 'warn', 'error'] as const) {
    jest
      .spyOn(Logger.prototype, level)
      .mockImplementation((...args: unknown[]) => {
        logs.push(String(args[0]));
      });
  }
});

afterEach(async () => {
  jest.restoreAllMocks();
  await fake.stop();
});

function client(overrides: Partial<ContentClientOptions> = {}): ContentClient {
  return new ContentClient({
    baseUrl,
    token: TOKEN,
    timeoutMs: 500,
    retryDelayMs: 1,
    ...overrides,
  });
}

function lookup(
  status: 'draft' | 'published' | 'unpublished',
  contentId = CONTENT_ID,
): Handler {
  return json(200, { contentId, publicationStatus: status });
}

describe('ContentClient.getPublication', () => {
  it('calls the Content lookup with the service identity and request ID', async () => {
    fake.reply(lookup('published'));

    await client({ baseUrl: `${baseUrl}/` }).getPublication(
      CONTENT_ID,
      REQUEST_ID,
    );

    expect(fake.requests).toHaveLength(1);
    const [request] = fake.requests;
    expect(request?.method).toBe('GET');
    expect(request?.url).toBe(`/internal/v1/items/${CONTENT_ID}/publication`);
    expect(request?.headers).toMatchObject({
      'x-service-name': 'nft',
      'x-service-token': TOKEN,
      'x-request-id': REQUEST_ID,
    });
    expect(request?.headers).not.toHaveProperty('x-caller-user-id');
  });

  it('maps a published item to "published"', async () => {
    fake.reply(lookup('published'));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'published', contentId: CONTENT_ID });
  });

  it.each(['draft', 'unpublished'] as const)(
    'maps a %s item to "not_published"',
    async (status) => {
      fake.reply(lookup(status));

      await expect(
        client().getPublication(CONTENT_ID, REQUEST_ID),
      ).resolves.toEqual({
        kind: 'not_published',
        contentId: CONTENT_ID,
        publicationStatus: status,
      });
    },
  );

  it('accepts additive fields from Content', async () => {
    fake.reply(
      json(200, {
        contentId: CONTENT_ID,
        publicationStatus: 'published',
        ownerId: 'ignored',
      }),
    );

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'published', contentId: CONTENT_ID });
  });

  it('maps 404, including a draft hidden by Content, to "not_found" without retrying', async () => {
    fake.reply(
      json(404, { code: 'NOT_FOUND', message: 'x', requestId: REQUEST_ID }),
    );

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'not_found' });
    expect(fake.requests).toHaveLength(1);
  });

  it.each([401, 403])(
    'maps %s to "unauthenticated" with a clear log line and no secret',
    async (status) => {
      fake.reply(json(status, { code: 'SERVICE_UNAUTHENTICATED' }));

      await expect(
        client().getPublication(CONTENT_ID, REQUEST_ID),
      ).resolves.toEqual({
        kind: 'content_unavailable',
        reason: 'unauthenticated',
      });
      expect(fake.requests).toHaveLength(1);
      expect(logs.join('\n')).toContain('CONTENT_SERVICE_TOKEN');
      expect(logs.join('\n')).toContain('CONTENT_INBOUND_TOKEN_NFT');
      expect(logs.join('\n')).toContain(REQUEST_ID);
      expect(logs.join('\n')).not.toContain(TOKEN);
    },
  );

  it('maps another 4xx to "rejected" without retrying', async () => {
    fake.reply(json(400, { code: 'VALIDATION_FAILED' }));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'content_unavailable', reason: 'rejected' });
    expect(fake.requests).toHaveLength(1);
  });

  it('does not call Content when the token is not configured', async () => {
    for (const token of [undefined, '']) {
      await expect(
        client({ token }).getPublication(CONTENT_ID, REQUEST_ID),
      ).resolves.toEqual({
        kind: 'content_unavailable',
        reason: 'not_configured',
      });
    }
    expect(fake.requests).toHaveLength(0);
    expect(logs.join('\n')).toContain('CONTENT_SERVICE_TOKEN is not set');
  });

  it('times out without retrying', async () => {
    fake.reply(hang, lookup('published'));

    await expect(
      client({ timeoutMs: 100 }).getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'content_unavailable', reason: 'timeout' });
    expect(fake.requests).toHaveLength(1);
    expect(logs.join('\n')).toContain('timed out');
  });

  it.each([502, 503, 504])(
    'retries a %s once and returns the second answer',
    async (status) => {
      fake.reply(text(status, 'down'), lookup('published'));

      await expect(
        client().getPublication(CONTENT_ID, REQUEST_ID),
      ).resolves.toEqual({ kind: 'published', contentId: CONTENT_ID });
      expect(fake.requests).toHaveLength(2);
      expect(fake.requests[1]?.headers['x-request-id']).toBe(REQUEST_ID);
    },
  );

  it('gives up after the bounded retry on repeated 503', async () => {
    fake.reply(text(503, 'down'), text(503, 'down'), lookup('published'));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({
      kind: 'content_unavailable',
      reason: 'upstream_error',
    });
    expect(fake.requests).toHaveLength(2);
  });

  it('does not retry a 500', async () => {
    fake.reply(json(500, { code: 'INTERNAL_ERROR' }), lookup('published'));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({
      kind: 'content_unavailable',
      reason: 'upstream_error',
    });
    expect(fake.requests).toHaveLength(1);
  });

  it('retries a dropped connection once', async () => {
    fake.reply(drop, lookup('unpublished'));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toMatchObject({ kind: 'not_published' });
    expect(fake.requests).toHaveLength(2);
  });

  it('reports a refused connection as "network"', async () => {
    await fake.stop();

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({ kind: 'content_unavailable', reason: 'network' });
    expect(logs.join('\n')).not.toContain(TOKEN);
    fake = new FakeContent();
    await fake.start();
  });

  it.each([
    ['a non-JSON body', text(200, 'ok')],
    [
      'an unknown status',
      json(200, { contentId: CONTENT_ID, publicationStatus: 'hidden' }),
    ],
    ['a missing contentId', json(200, { publicationStatus: 'published' })],
    [
      'another contentId',
      lookup('published', 'a1b2c3d4-0000-4000-8000-000000000000'),
    ],
  ])('maps %s to "invalid_response"', async (_label, handler) => {
    fake.reply(handler);

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toEqual({
      kind: 'content_unavailable',
      reason: 'invalid_response',
    });
  });

  it('matches the contentId case-insensitively', async () => {
    fake.reply(lookup('published', CONTENT_ID.toUpperCase()));

    await expect(
      client().getPublication(CONTENT_ID, REQUEST_ID),
    ).resolves.toMatchObject({ kind: 'published' });
  });
});
