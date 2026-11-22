import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AppConfig } from '../src/config/app-config.js';
import { configureApp } from '../src/http/configure-app.js';
import {
  json,
  parseJson,
  type RecordedRequest,
  StubUpstream,
} from './support/stub-upstream.js';

const TOKENS = {
  auth: 'gateway-to-auth-token-0123456789abcdef',
  content: 'gateway-to-content-token-0123456789abcd',
  nft: 'gateway-to-nft-token-0123456789abcdefgh',
  lidar: 'gateway-to-lidar-token-0123456789abcdef',
};
const ADMIN_TOKEN = 'operator-admin-token-0123456789abcdefgh';
const ORIGIN = 'http://localhost:5173';
const ACCOUNT_ID = '7d8f2b0e-4f7a-4c55-9a62-0c6b8d3f1e21';
const ITEM_ID = '3b1f6c8e-2a4d-4e8f-9b7c-1d2e3f4a5b6c';
const SESSION_TOKEN = 'k'.repeat(43);
const PASSWORD = 'Lova heritage 2026';
const COOKIE = `lova_session=${SESSION_TOKEN}`;

describe('gateway', () => {
  const auth = new StubUpstream();
  const content = new StubUpstream();
  const nft = new StubUpstream();
  const lidar = new StubUpstream();
  let permissions: string[] = [];
  let app: NestExpressApplication;
  let http: App;

  function fakeAuth(): void {
    auth.respond((req, res) => {
      const body =
        req.body.length > 0 ? (parseJson(req) as Record<string, unknown>) : {};
      const expiresAt = new Date(Date.now() + 7_200_000).toISOString();
      switch (`${req.method} ${req.url}`) {
        case 'POST /internal/v1/accounts':
          json(res, 201, { accountId: ACCOUNT_ID });
          return;
        case 'POST /internal/v1/sessions':
          if (body['password'] === PASSWORD) {
            json(res, 201, {
              accountId: ACCOUNT_ID,
              token: SESSION_TOKEN,
              expiresAt,
            });
          } else {
            json(res, 401, {
              code: 'INVALID_CREDENTIALS',
              message: 'The email or password is incorrect.',
              requestId: 'x',
            });
          }
          return;
        case 'POST /internal/v1/sessions/introspect':
          if (body['token'] === SESSION_TOKEN) {
            json(res, 200, { accountId: ACCOUNT_ID, permissions, expiresAt });
          } else {
            json(res, 401, {
              code: 'SESSION_INVALID',
              message: 'The session is invalid or has expired.',
              requestId: 'x',
            });
          }
          return;
        case `GET /internal/v1/accounts/${ACCOUNT_ID}`:
          json(res, 200, {
            accountId: ACCOUNT_ID,
            email: 'ana@example.org',
            displayName: 'Ana',
            permissions,
            createdAt: expiresAt,
          });
          return;
        default:
          res.writeHead(204).end();
      }
    });
  }

  beforeAll(async () => {
    const [authUrl, contentUrl, nftUrl, lidarUrl] = await Promise.all(
      [auth, content, nft, lidar].map((stub) => stub.start()),
    );
    const config: AppConfig = {
      port: 0,
      upstreams: {
        auth: { url: authUrl ?? '', token: TOKENS.auth },
        content: { url: contentUrl ?? '', token: TOKENS.content },
        nft: { url: nftUrl ?? '', token: TOKENS.nft },
        lidar: { url: lidarUrl ?? '', token: TOKENS.lidar },
      },
      adminToken: ADMIN_TOKEN,
      allowedOrigins: [ORIGIN],
      sessionCookie: { secure: false, maxAgeSeconds: 604_800 },
      timeouts: { upstreamMs: 300, authMs: 300, uploadMs: 2000 },
      maxUploadBytes: 1024,
      authRateLimitPerMinute: 5,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApp(app, config);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all([auth, content, nft, lidar].map((stub) => stub.stop()));
  });

  beforeEach(() => {
    permissions = [];
    for (const stub of [auth, content, nft, lidar]) stub.reset();
    fakeAuth();
    content.respond((_req, res) => {
      json(res, 200, { items: [], nextCursor: null });
    });
  });

  function expectServiceHeaders(
    recorded: RecordedRequest,
    token: string,
  ): void {
    expect(recorded.headers['x-service-name']).toBe('gateway');
    expect(recorded.headers['x-service-token']).toBe(token);
    expect(recorded.headers['x-request-id']).toEqual(expect.any(String));
    expect(recorded.headers.cookie).toBeUndefined();
  }

  describe('guest browsing', () => {
    it('forwards public listings without calling Auth or sending an identity (CA10)', async () => {
      await request(http)
        .get('/api/items?scope=public&limit=5')
        .expect(200, { items: [], nextCursor: null });
      expect(auth.requests).toHaveLength(0);
      const forwarded = content.last();
      expect(forwarded.url).toBe('/internal/v1/items?scope=public&limit=5');
      expectServiceHeaders(forwarded, TOKENS.content);
      expect(forwarded.headers['x-caller-user-id']).toBeUndefined();
      expect(forwarded.headers['x-caller-permissions']).toBe('');
    });

    it('replaces spoofed identity and service headers (CA11)', async () => {
      await request(http)
        .get(`/api/items/${ITEM_ID}`)
        .set('x-caller-user-id', ACCOUNT_ID)
        .set('x-caller-permissions', 'reviewer')
        .set('x-service-name', 'nft')
        .set('x-service-token', 'forged')
        .expect(200);
      const forwarded = content.last();
      expect(forwarded.url).toBe(`/internal/v1/items/${ITEM_ID}`);
      expectServiceHeaders(forwarded, TOKENS.content);
      expect(forwarded.headers['x-caller-user-id']).toBeUndefined();
      expect(forwarded.headers['x-caller-permissions']).toBe('');
    });

    it('serves guests when the session cookie is no longer valid, and clears it', async () => {
      const response = await request(http)
        .get('/api/items')
        .set('cookie', `lova_session=${'z'.repeat(43)}`)
        .expect(200);
      expect(response.headers['set-cookie']?.[0]).toMatch(
        /^lova_session=; .*Max-Age=0/,
      );
      expect(content.last().headers['x-caller-user-id']).toBeUndefined();
    });

    it('validates item IDs before calling any service', async () => {
      const response = await request(http)
        .get('/api/items/not-a-uuid')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'id' }],
      });
      expect(content.requests).toHaveLength(0);
    });
  });

  describe('sessions', () => {
    it('logs in with an HttpOnly SameSite=Lax cookie and returns the account', async () => {
      const response = await request(http)
        .post('/api/auth/login')
        .set('origin', ORIGIN)
        .send({ email: 'ana@example.org', password: PASSWORD })
        .expect(200);
      expect(response.body).toMatchObject({
        userId: ACCOUNT_ID,
        email: 'ana@example.org',
        displayName: 'Ana',
        permissions: [],
      });
      const cookie = response.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toContain(`lova_session=${SESSION_TOKEN}`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expectServiceHeaders(auth.requests[0] as RecordedRequest, TOKENS.auth);
    });

    it('returns the Auth error for wrong credentials and sets no cookie', async () => {
      const response = await request(http)
        .post('/api/auth/login')
        .set('origin', ORIGIN)
        .send({ email: 'ana@example.org', password: 'not the password' })
        .expect(401);
      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('propagates the verified identity and permissions to the owning service', async () => {
      permissions = ['reviewer'];
      await request(http)
        .post(`/api/items/${ITEM_ID}/review`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .set('x-caller-user-id', '00000000-0000-4000-8000-000000000000')
        .send({
          target: 'item',
          outcome: 'verified',
          rationale: 'Signed by the workshop',
          evidence: [],
        })
        .expect(200);
      const forwarded = content.last();
      expect(forwarded.method).toBe('POST');
      expect(forwarded.url).toBe(`/internal/v1/items/${ITEM_ID}/review`);
      expect(forwarded.headers['x-caller-user-id']).toBe(ACCOUNT_ID);
      expect(forwarded.headers['x-caller-permissions']).toBe('reviewer');
      expect(parseJson(forwarded)).toMatchObject({
        target: 'item',
        outcome: 'verified',
      });
    });

    it('refuses protected routes without a session and forwards nothing', async () => {
      const response = await request(http)
        .post('/api/items')
        .set('origin', ORIGIN)
        .send({ title: 'Lamba' })
        .expect(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHENTICATED',
        requestId: expect.any(String) as unknown,
      });
      expect(content.requests).toHaveLength(0);
    });

    it('reads the signed-in account', async () => {
      const response = await request(http)
        .get('/api/auth/me')
        .set('cookie', COOKIE)
        .expect(200);
      expect(response.body).toMatchObject({
        userId: ACCOUNT_ID,
        email: 'ana@example.org',
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('revokes the session on logout and clears the cookie (CA9)', async () => {
      const response = await request(http)
        .post('/api/auth/logout')
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .expect(204);
      expect(response.headers['set-cookie']?.[0]).toMatch(/Max-Age=0/);
      const revoke = auth.requests.find(
        (r) => r.url === '/internal/v1/sessions/revoke',
      );
      expect(revoke && parseJson(revoke)).toEqual({ token: SESSION_TOKEN });
    });

    it('accepts logout without a session', async () => {
      await request(http)
        .post('/api/auth/logout')
        .set('origin', ORIGIN)
        .expect(204);
      expect(auth.requests).toHaveLength(0);
    });

    it('fails closed with 503 when Auth does not answer in time (CA14)', async () => {
      auth.respond(async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        res.writeHead(204).end();
      });
      const response = await request(http)
        .post('/api/items')
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .send({ title: 'Lamba' })
        .expect(503);
      expect(response.body).toMatchObject({ code: 'AUTH_UNAVAILABLE' });
      expect(content.requests).toHaveLength(0);
    });

    it('rate limits login attempts per client', async () => {
      const attempt = () =>
        request(http)
          .post('/api/auth/login')
          .set('origin', ORIGIN)
          .send({ email: 'ana@example.org', password: 'not the password' });
      const statuses: number[] = [];
      for (let index = 0; index < 6; index += 1)
        statuses.push((await attempt()).status);
      expect(statuses.at(-1)).toBe(429);
      const limited = await attempt();
      expect(limited.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('browser safeguards', () => {
    it('rejects state-changing requests from other origins (CSRF)', async () => {
      const response = await request(http)
        .post('/api/auth/register')
        .set('origin', 'https://evil.example')
        .send({ email: 'ana@example.org', password: PASSWORD })
        .expect(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
      expect(auth.requests).toHaveLength(0);
    });

    it('rejects cookie-authenticated writes without an Origin or Referer', async () => {
      await request(http)
        .post('/api/items')
        .set('cookie', COOKIE)
        .send({})
        .expect(403);
      expect(content.requests).toHaveLength(0);
    });

    it('answers CORS preflights for the configured frontend origin only', async () => {
      const allowed = await request(http)
        .options('/api/items')
        .set('origin', ORIGIN)
        .set('access-control-request-method', 'POST');
      expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');
      const denied = await request(http)
        .options('/api/items')
        .set('origin', 'https://evil.example')
        .set('access-control-request-method', 'POST');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('error mapping', () => {
    it('relays service error codes in the public shape', async () => {
      content.respond((_req, res) => {
        json(res, 422, {
          code: 'NOT_PUBLISHABLE',
          message: 'Both claims must be reviewed first.',
          requestId: 'upstream',
        });
      });
      permissions = ['reviewer'];
      const response = await request(http)
        .post(`/api/items/${ITEM_ID}/decision`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .set('x-request-id', 'trace-123')
        .send({ decision: 'publish', note: '' })
        .expect(422);
      expect(response.body).toEqual({
        code: 'NOT_PUBLISHABLE',
        message: 'Both claims must be reviewed first.',
        requestId: 'trace-123',
      });
      expect(content.last().headers['x-request-id']).toBe('trace-123');
    });

    it('hides upstream failures behind 502 UPSTREAM_ERROR', async () => {
      content.respond((_req, res) => {
        json(res, 500, {
          message: 'TypeError at /srv/content/src/items.ts:42',
          stack: 'secret',
        });
      });
      const response = await request(http).get('/api/items').expect(502);
      expect(response.body).toMatchObject({ code: 'UPSTREAM_ERROR' });
      expect(JSON.stringify(response.body)).not.toContain('items.ts');
    });

    it('replaces non-contract error bodies with the generic code for the status', async () => {
      content.respond((_req, res) => {
        json(res, 404, {
          statusCode: 404,
          message: 'Cannot GET /internal/v1/items/x',
          error: 'Not Found',
        });
      });
      const response = await request(http)
        .get(`/api/items/${ITEM_ID}`)
        .expect(404);
      expect(response.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'The resource was not found.',
      });
    });

    it('maps an unreachable service to 503 <SERVICE>_UNAVAILABLE', async () => {
      content.respond(async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        json(res, 200, {});
      });
      const response = await request(http).get('/api/items').expect(503);
      expect(response.body).toMatchObject({ code: 'CONTENT_UNAVAILABLE' });
    });

    it('answers unknown routes with the public error shape', async () => {
      const response = await request(http)
        .get('/api/does-not-exist')
        .expect(404);
      expect(response.body).toMatchObject({
        code: 'NOT_FOUND',
        requestId: expect.any(String) as unknown,
      });
    });
  });

  describe('provenance and 3D', () => {
    it('requires an idempotency key to mint', async () => {
      const response = await request(http)
        .post(`/api/items/${ITEM_ID}/mint`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .expect(400);
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
      expect(nft.requests).toHaveLength(0);
    });

    it('sends the item ID and idempotency key to NFT and relays the pending mint', async () => {
      nft.respond((_req, res) => {
        json(res, 202, { mintId: 'm1', contentId: ITEM_ID, status: 'pending' });
      });
      const key = 'k'.repeat(24);
      const response = await request(http)
        .post(`/api/items/${ITEM_ID}/mint`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .set('idempotency-key', key)
        .send({ contentId: 'ignored' })
        .expect(202);
      expect(response.body).toMatchObject({ status: 'pending' });
      const forwarded = nft.last();
      expect(forwarded.url).toBe('/internal/v1/mints');
      expect(forwarded.headers['idempotency-key']).toBe(key);
      expect(forwarded.headers['x-caller-user-id']).toBe(ACCOUNT_ID);
      expectServiceHeaders(forwarded, TOKENS.nft);
      expect(parseJson(forwarded)).toEqual({ contentId: ITEM_ID });
    });

    it('maps a ready LiDAR asset to the frozen 3D descriptor', async () => {
      lidar.respond((_req, res) => {
        json(res, 200, {
          contentId: ITEM_ID,
          status: 'ready',
          variants: {
            '1k': { url: '/api/lidar/files/a/1k', bytes: 10 },
            '2k': { url: '/api/lidar/files/a/2k', bytes: 20 },
          },
          poster: { url: '/api/lidar/files/a/poster' },
          ar: null,
        });
      });
      await request(http)
        .get(`/api/items/${ITEM_ID}/model3d`)
        .expect(200, {
          contentId: ITEM_ID,
          status: 'ready',
          variants: {
            poster: '/api/lidar/files/a/poster',
            glb1k: '/api/lidar/files/a/1k',
            glb2k: '/api/lidar/files/a/2k',
          },
        });
      expect(lidar.last().url).toBe(`/assets/by-content/${ITEM_ID}`);
    });

    it('reports a missing model when LiDAR has none', async () => {
      lidar.respond((_req, res) => {
        json(res, 200, { contentId: ITEM_ID, status: 'none' });
      });
      await request(http)
        .get(`/api/items/${ITEM_ID}/model3d`)
        .expect(200, { contentId: ITEM_ID, status: 'missing', variants: null });
    });

    it('refuses 3D delivery URLs that leave the gateway', async () => {
      lidar.respond((_req, res) => {
        json(res, 200, {
          contentId: ITEM_ID,
          status: 'ready',
          variants: {
            '1k': { url: 'http://seaweedfs:8333/bucket/key' },
            '2k': { url: '/api/lidar/files/a/2k' },
          },
          poster: { url: '/api/lidar/files/a/poster' },
        });
      });
      await request(http).get(`/api/items/${ITEM_ID}/model3d`).expect(502);
    });

    it('streams 3D files and keeps range headers', async () => {
      lidar.respond((_req, res) => {
        res.writeHead(206, {
          'content-type': 'model/gltf-binary',
          'content-range': 'bytes 0-3/8',
          'x-internal': 'hidden',
        });
        res.end(Buffer.from('glTF'));
      });
      const response = await request(http)
        .get('/api/lidar/files/asset-1/1k.glb')
        .set('range', 'bytes=0-3')
        .expect(206);
      expect(response.headers['content-range']).toBe('bytes 0-3/8');
      expect(response.headers['x-internal']).toBeUndefined();
      expect(lidar.last().url).toBe('/files/asset-1/1k.glb');
      expect(lidar.last().headers.range).toBe('bytes=0-3');
    });

    it.each(['/api/lidar/files/..%2fsecret', '/api/lidar/files/a/%2e%2e/b'])(
      'refuses the traversal path %s',
      async (path) => {
        await request(http).get(path).expect(404);
        expect(lidar.requests).toHaveLength(0);
      },
    );
  });

  describe('uploads', () => {
    it('streams multipart uploads to Content unchanged', async () => {
      content.respond((_req, res) => {
        json(res, 201, { id: 'media-1' });
      });
      await request(http)
        .post(`/api/items/${ITEM_ID}/media`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .attach('file', Buffer.from('fake image bytes'), {
          filename: 'lamba.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      const forwarded = content.last();
      expect(forwarded.headers['content-type']).toMatch(
        /^multipart\/form-data; boundary=/,
      );
      expect(forwarded.body.toString('utf8')).toContain('fake image bytes');
    });

    it('refuses uploads above the configured limit', async () => {
      const response = await request(http)
        .post(`/api/items/${ITEM_ID}/media`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .attach('file', Buffer.alloc(4096, 1), {
          filename: 'big.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);
      expect(response.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    });

    it('refuses uploads that are not multipart', async () => {
      await request(http)
        .post(`/api/items/${ITEM_ID}/media`)
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .send({ file: 'x' })
        .expect(415);
    });
  });

  describe('operator routes', () => {
    it('require the admin token', async () => {
      await request(http)
        .put('/api/admin/permissions')
        .send({ email: 'ana@example.org', permission: 'reviewer' })
        .expect(401);
      expect(auth.requests).toHaveLength(0);
    });

    it('grant a permission through Auth', async () => {
      await request(http)
        .put('/api/admin/permissions')
        .set('x-admin-token', ADMIN_TOKEN)
        .send({ email: 'ana@example.org', permission: 'reviewer' })
        .expect(204);
      const forwarded = auth.last();
      expect(forwarded.url).toBe('/internal/v1/permissions/grant');
      expect(parseJson(forwarded)).toEqual({
        email: 'ana@example.org',
        permission: 'reviewer',
      });
    });
  });

  describe('image-to-3D generations', () => {
    const GENERATION_ID = '5c2a7e10-8b3d-4f6a-9e1c-2d3b4a5f6e7d';
    const IMAGE = `data:image/png;base64,${'A'.repeat(1_200_000)}`;

    it('requires a session and never calls LiDAR for a guest', async () => {
      await request(http)
        .post('/api/generations')
        .set('origin', ORIGIN)
        .send({ image: 'data:image/png;base64,AAAA' })
        .expect(401);
      await request(http).get(`/api/generations/${GENERATION_ID}`).expect(401);
      expect(lidar.requests).toHaveLength(0);
    });

    it('forwards an image larger than the default JSON limit with the caller identity', async () => {
      lidar.respond((_req, res) => {
        json(res, 202, { id: GENERATION_ID, status: 'queued' });
      });
      await request(http)
        .post('/api/generations')
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .send({ image: IMAGE, title: 'Sobika' })
        .expect(202, { id: GENERATION_ID, status: 'queued' });
      const forwarded = lidar.last();
      expect(forwarded.url).toBe('/internal/v1/generations');
      expectServiceHeaders(forwarded, TOKENS.lidar);
      expect(forwarded.headers['x-caller-user-id']).toBe(ACCOUNT_ID);
      expect(parseJson(forwarded)).toEqual({ image: IMAGE, title: 'Sobika' });
    });

    it('relays the status and the model of one generation', async () => {
      lidar.respond((req, res) => {
        if (req.url.endsWith('/model.glb')) {
          res
            .writeHead(200, { 'content-type': 'model/gltf-binary' })
            .end('glTF');
          return;
        }
        json(res, 200, { id: GENERATION_ID, status: 'ready' });
      });
      await request(http)
        .get(`/api/generations/${GENERATION_ID}`)
        .set('cookie', COOKIE)
        .expect(200, { id: GENERATION_ID, status: 'ready' });
      expect(lidar.last().url).toBe(
        `/internal/v1/generations/${GENERATION_ID}`,
      );
      const model = await request(http)
        .get(`/api/generations/${GENERATION_ID}/model.glb`)
        .set('cookie', COOKIE)
        .expect(200);
      expect(model.headers['content-type']).toBe('model/gltf-binary');
    });

    it('rejects a malformed generation ID before calling LiDAR', async () => {
      await request(http)
        .get('/api/generations/not-a-uuid')
        .set('cookie', COOKIE)
        .expect(400);
      expect(lidar.requests).toHaveLength(0);
    });

    it('keeps LiDAR public errors such as an exhausted quota', async () => {
      lidar.respond((_req, res) => {
        json(res, 402, {
          code: 'GENERATION_CREDITS_EXHAUSTED',
          message: 'The 3D generation quota is exhausted.',
          requestId: 'x',
        });
      });
      const response = await request(http)
        .post('/api/generations')
        .set('origin', ORIGIN)
        .set('cookie', COOKIE)
        .send({ image: 'data:image/png;base64,AAAA' })
        .expect(402);
      expect(response.body).toMatchObject({
        code: 'GENERATION_CREDITS_EXHAUSTED',
      });
    });
  });

  it('reports upstream health', async () => {
    content.respond((_req, res) => {
      res.writeHead(503).end();
    });
    await request(http)
      .get('/api/health')
      .expect(200, {
        status: 'degraded',
        upstreams: { auth: 'up', content: 'down', nft: 'up', lidar: 'up' },
      });
  });
});
