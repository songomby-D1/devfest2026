import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const CONTENT_TOKEN = 'nft-to-content-test';

export interface FakeItem {
  readonly ownerId: string;
  readonly publicationStatus: 'draft' | 'published' | 'unpublished';
}

/**
 * Fake Content for the two lookups NFT makes: the publication lookup and
 * the item detail, whose `isOwner` comes from the relayed caller header.
 */
export class FakeContent {
  readonly items = new Map<string, FakeItem>();
  readonly requests: { url: string; headers: IncomingHttpHeaders }[] = [];
  /** Answer every request with this status instead (e.g. 503). */
  failWith: number | undefined;
  private readonly server: Server;

  constructor() {
    this.server = createServer((req, res) => {
      const url = req.url ?? '';
      this.requests.push({ url, headers: req.headers });
      const reply = (status: number, body: unknown): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.headers['x-service-token'] !== CONTENT_TOKEN) {
        reply(401, { code: 'SERVICE_UNAUTHENTICATED' });
        return;
      }
      if (this.failWith !== undefined) {
        reply(this.failWith, { code: 'UPSTREAM' });
        return;
      }
      const match = /^\/internal\/v1\/items\/([^/]+)(\/publication)?$/.exec(
        url,
      );
      const id = match?.[1];
      const item = id === undefined ? undefined : this.items.get(id);
      if (id === undefined || item === undefined) {
        reply(404, { code: 'NOT_FOUND' });
        return;
      }
      if (match?.[2] !== undefined) {
        reply(200, {
          contentId: id,
          publicationStatus: item.publicationStatus,
        });
        return;
      }
      reply(200, {
        id,
        title: 'Lamba mena',
        publicationStatus: item.publicationStatus,
        isOwner: req.headers['x-caller-user-id'] === item.ownerId,
      });
    });
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}
