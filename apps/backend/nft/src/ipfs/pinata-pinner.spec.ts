import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { PinataPinner } from './pinata-pinner';
import { IpfsError } from './pinner';

const JWT = 'pinata-test-jwt';
const CID = `bafkrei${'a'.repeat(52)}`;

interface Received {
  readonly authorization: string | undefined;
  readonly body: string;
}

type Handler = (req: IncomingMessage, body: string) => [number, string] | null;

describe('PinataPinner', () => {
  let server: Server;
  let received: Received[];
  let handler: Handler;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({ authorization: req.headers.authorization, body });
        const answer = handler(req, body);
        if (answer === null) return; // never answer: timeout
        res.writeHead(answer[0], { 'content-type': 'application/json' });
        res.end(answer[1]);
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    received = [];
    handler = () => [
      200,
      JSON.stringify({ IpfsHash: CID, isDuplicate: false }),
    ];
  });

  afterEach(() => jest.restoreAllMocks());

  function pinner(options: { jwt?: string; timeoutMs?: number } = {}) {
    return new PinataPinner({
      jwt: 'jwt' in options ? options.jwt : JWT,
      timeoutMs: options.timeoutMs ?? 2000,
      apiUrl: baseUrl,
      retryDelayMs: 1,
    });
  }

  const request = {
    name: 'lova-3f2b8c1e-metadata.json',
    bytes: new TextEncoder().encode('{"name":"Lamba"}'),
    contentType: 'application/json',
    keyvalues: { contentId: '3f2b8c1e', role: 'metadata' },
  };

  it('uploads the bytes as a file with a deterministic name and CIDv1', async () => {
    await expect(pinner().pin(request, 'req-1')).resolves.toEqual({ cid: CID });

    expect(received).toHaveLength(1);
    const [call] = received;
    expect(call?.authorization).toBe(`Bearer ${JWT}`);
    expect(call?.body).toContain('{"name":"Lamba"}');
    expect(call?.body).toContain('filename="lova-3f2b8c1e-metadata.json"');
    expect(call?.body).toContain(
      '{"name":"lova-3f2b8c1e-metadata.json","keyvalues":{"contentId":"3f2b8c1e","role":"metadata"}}',
    );
    expect(call?.body).toContain('{"cidVersion":1}');
  });

  it('fails without calling Pinata when the JWT is missing', async () => {
    await expect(pinner({ jwt: '' }).pin(request, 'r')).rejects.toEqual(
      new IpfsError('not_configured'),
    );
    expect(received).toHaveLength(0);
  });

  it('does not retry a refused JWT, and never logs or returns it', async () => {
    const logs: string[] = [];
    const record = (...args: unknown[]): void => {
      logs.push(args.map(String).join(' '));
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record);
    handler = () => [401, JSON.stringify({ error: 'bad jwt' })];

    const error = await pinner()
      .pin(request, 'r')
      .catch((e: unknown) => e);

    expect(error).toEqual(new IpfsError('unauthenticated'));
    expect(received).toHaveLength(1);
    expect((error as Error).message).not.toContain(JWT);
    expect(logs.join('\n')).not.toContain(JWT);
  });

  it('retries once on a 503', async () => {
    let calls = 0;
    handler = () => {
      calls += 1;
      return calls === 1
        ? [503, '{}']
        : [200, JSON.stringify({ IpfsHash: CID })];
    };

    await expect(pinner().pin(request, 'r')).resolves.toEqual({ cid: CID });
    expect(received).toHaveLength(2);
  });

  it('reports a timeout without retrying', async () => {
    handler = () => null;

    await expect(pinner({ timeoutMs: 100 }).pin(request, 'r')).rejects.toEqual(
      new IpfsError('timeout'),
    );
    expect(received).toHaveLength(1);
  });

  it('rejects an answer without a valid CID', async () => {
    handler = () => [200, JSON.stringify({ IpfsHash: 'not a cid' })];

    await expect(pinner().pin(request, 'r')).rejects.toEqual(
      new IpfsError('invalid_response'),
    );
  });
});
