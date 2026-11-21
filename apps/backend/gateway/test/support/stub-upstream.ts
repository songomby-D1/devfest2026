import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

export type StubHandler = (
  request: RecordedRequest,
  response: ServerResponse,
) => void | Promise<void>;

/** A fake internal service that records what the gateway sends it. */
export class StubUpstream {
  readonly requests: RecordedRequest[] = [];
  private handler: StubHandler = (_request, response) => {
    json(response, 200, { status: 'ok' });
  };
  private readonly server: Server;

  constructor() {
    this.server = createServer((incoming, response) => {
      void this.handle(incoming, response);
    });
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

  respond(handler: StubHandler): void {
    this.handler = handler;
  }

  reset(): void {
    this.requests.length = 0;
    this.respond((_request, response) => {
      json(response, 200, { status: 'ok' });
    });
  }

  last(): RecordedRequest {
    const last = this.requests.at(-1);
    if (last === undefined) throw new Error('No request reached this upstream');
    return last;
  }

  private async handle(
    incoming: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    const recorded: RecordedRequest = {
      method: incoming.method ?? 'GET',
      url: incoming.url ?? '/',
      headers: incoming.headers,
      body: Buffer.concat(chunks),
    };
    this.requests.push(recorded);
    await this.handler(recorded, response);
  }
}

export function json(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export function parseJson(request: RecordedRequest): unknown {
  return JSON.parse(request.body.toString('utf8')) as unknown;
}
