import { createHash } from 'node:crypto';
import { ConsoleLogger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/application/auth.service.js';
import type { AppConfig } from '../src/config/app-config.js';
import { configureApp } from '../src/http/configure-app.js';
import { ConcurrencyLimiter } from '../src/infrastructure/concurrency-limiter.js';
import { ScryptPasswordHasher } from '../src/infrastructure/scrypt-password-hasher.js';
import {
  adminDatabaseUrl,
  createTestDatabase,
  databaseRequired,
  type TestDatabase,
} from './support/test-database.js';

const GATEWAY_TOKEN = 'integration-gateway-token-0123456789abcdef';
const PASSWORD = 'Lova heritage 2026';
const gateway = {
  'x-service-name': 'gateway',
  'x-service-token': GATEWAY_TOKEN,
};

class CapturingLogger extends ConsoleLogger {
  readonly lines: string[] = [];

  override log(message: unknown): void {
    this.lines.push(String(message));
  }

  override warn(message: unknown): void {
    this.lines.push(String(message));
  }

  override error(message: unknown): void {
    this.lines.push(String(message));
  }
}

if (adminDatabaseUrl === undefined && databaseRequired) {
  throw new Error(
    'AUTH_TEST_DATABASE_URL is required when REQUIRE_DB_TESTS=true',
  );
}
if (adminDatabaseUrl === undefined) {
  console.warn(
    'Skipping Auth integration tests: AUTH_TEST_DATABASE_URL is not set.',
  );
}

describe.skipIf(adminDatabaseUrl === undefined)(
  'Auth internal API with PostgreSQL',
  () => {
    let database: TestDatabase;
    let app: NestExpressApplication;
    let http: App;
    const logger = new CapturingLogger();

    beforeAll(async () => {
      database = await createTestDatabase(adminDatabaseUrl ?? '');
      const config: AppConfig = {
        port: 0,
        databaseUrl: database.url,
        inboundTokens: { gateway: GATEWAY_TOKEN },
        session: { idleMs: 2 * 3600_000, absoluteMs: 7 * 86_400_000 },
        passwordHashing: { concurrency: 4, maxWaitMs: 5000 },
      };
      const hasher = new ScryptPasswordHasher(new ConcurrencyLimiter(4, 5000), {
        log2N: 10,
        r: 8,
        p: 1,
      });
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule.register(config, { passwordHasher: hasher })],
      }).compile();
      app = moduleRef.createNestApplication<NestExpressApplication>({
        bodyParser: false,
        logger,
      });
      configureApp(app);
      await app.init();
      http = app.getHttpServer();
    });

    afterAll(async () => {
      await app.close();
      await database.drop();
    });

    async function register(email: string): Promise<string> {
      const response = await request(http)
        .post('/internal/v1/accounts')
        .set(gateway)
        .send({ email, password: PASSWORD })
        .expect(201);
      return (response.body as { accountId: string }).accountId;
    }

    async function login(email: string): Promise<string> {
      const response = await request(http)
        .post('/internal/v1/sessions')
        .set(gateway)
        .send({ email, password: PASSWORD })
        .expect(201);
      return (response.body as { token: string }).token;
    }

    it('answers its health check', async () => {
      await request(http).get('/health').expect(200, { status: 'ok' });
    });

    it('registers an account and stores only a password hash (CA1)', async () => {
      const accountId = await register('ana@example.org');
      expect(accountId).toMatch(/^[0-9a-f-]{36}$/);
      const [row] = await database.query<{ password_hash: string }>(
        'SELECT password_hash FROM accounts WHERE id = $1',
        [accountId],
      );
      expect(row?.password_hash).toMatch(/^scrypt\$/);
      expect(row?.password_hash).not.toContain(PASSWORD);
    });

    it('refuses the same email in another case and with spaces (CA2)', async () => {
      const response = await request(http)
        .post('/internal/v1/accounts')
        .set(gateway)
        .send({ email: '  ANA@example.org ', password: PASSWORD })
        .expect(409);
      expect(response.body).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it('lets exactly one of two concurrent registrations win', async () => {
      const attempt = () =>
        request(http)
          .post('/internal/v1/accounts')
          .set(gateway)
          .send({ email: 'race@example.org', password: PASSWORD });
      const statuses = (await Promise.all([attempt(), attempt()])).map(
        (r) => r.status,
      );
      expect(statuses.sort()).toEqual([201, 409]);
    });

    it.each([
      [{ email: 'bad', password: PASSWORD }, 'email'],
      [{ email: 'bo@example.org', password: 'short' }, 'password'],
      [{ email: 'bo@example.org', password: 'p'.repeat(129) }, 'password'],
      [
        { email: 'bo@example.org', password: PASSWORD, role: 'reviewer' },
        'role',
      ],
    ])('rejects %j and creates nothing (CA3)', async (body, field) => {
      const response = await request(http)
        .post('/internal/v1/accounts')
        .set(gateway)
        .send(body)
        .expect(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(
        (response.body as { details: { field: string }[] }).details.map(
          (d) => d.field,
        ),
      ).toContain(field);
      const rows = await database.query(
        'SELECT 1 FROM accounts WHERE email = $1',
        ['bo@example.org'],
      );
      expect(rows).toHaveLength(0);
    });

    it('rejects bodies that are not JSON or larger than 10 KB', async () => {
      await request(http)
        .post('/internal/v1/accounts')
        .set(gateway)
        .set('content-type', 'application/json')
        .send('{"email":')
        .expect(400);
      const response = await request(http)
        .post('/internal/v1/accounts')
        .set(gateway)
        .send({
          email: 'big@example.org',
          password: PASSWORD,
          displayName: 'x'.repeat(11_000),
        })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('opens a session and persists only the SHA-256 of its token (CA4)', async () => {
      const token = await login('ana@example.org');
      const rows = await database.query<{ token_hash: string }>(
        'SELECT token_hash FROM sessions',
      );
      const expected = createHash('sha256').update(token).digest('hex');
      expect(rows.map((row) => row.token_hash)).toContain(expected);
      expect(rows.map((row) => row.token_hash)).not.toContain(token);
    });

    it('answers a wrong password and an unknown email identically (CA5)', async () => {
      const wrong = await request(http)
        .post('/internal/v1/sessions')
        .set(gateway)
        .send({ email: 'ana@example.org', password: 'not the password!' })
        .expect(401);
      const unknown = await request(http)
        .post('/internal/v1/sessions')
        .set(gateway)
        .send({ email: 'nobody@example.org', password: PASSWORD })
        .expect(401);
      const strip = ({
        requestId: _ignored,
        ...rest
      }: Record<string, unknown>) => rest;
      expect(strip(wrong.body as Record<string, unknown>)).toEqual(
        strip(unknown.body as Record<string, unknown>),
      );
    });

    it('introspects, revokes idempotently and then rejects the token (CA6, CA9)', async () => {
      const token = await login('ana@example.org');
      const introspection = await request(http)
        .post('/internal/v1/sessions/introspect')
        .set(gateway)
        .send({ token })
        .expect(200);
      expect(introspection.body).toMatchObject({ permissions: [] });
      expect(
        Date.parse((introspection.body as { expiresAt: string }).expiresAt),
      ).toBeGreaterThan(Date.now());

      await request(http)
        .post('/internal/v1/sessions/revoke')
        .set(gateway)
        .send({ token })
        .expect(204);
      await request(http)
        .post('/internal/v1/sessions/revoke')
        .set(gateway)
        .send({ token })
        .expect(204);
      const after = await request(http)
        .post('/internal/v1/sessions/introspect')
        .set(gateway)
        .send({ token })
        .expect(401);
      expect(after.body).toMatchObject({ code: 'SESSION_INVALID' });
    });

    it('grants and revokes the reviewer permission (CA13)', async () => {
      const token = await login('ana@example.org');
      const introspect = async () =>
        (
          await request(http)
            .post('/internal/v1/sessions/introspect')
            .set(gateway)
            .send({ token })
            .expect(200)
        ).body as { permissions: string[] };

      await request(http)
        .post('/internal/v1/permissions/grant')
        .set(gateway)
        .send({ email: 'ana@example.org', permission: 'reviewer' })
        .expect(204);
      expect((await introspect()).permissions).toEqual(['reviewer']);

      await request(http)
        .post('/internal/v1/permissions/revoke')
        .set(gateway)
        .send({ email: 'ana@example.org', permission: 'reviewer' })
        .expect(204);
      expect((await introspect()).permissions).toEqual([]);
    });

    it('reads an account without exposing the password hash', async () => {
      const accountId = await register('rova@example.org');
      const response = await request(http)
        .get(`/internal/v1/accounts/${accountId}`)
        .set(gateway)
        .expect(200);
      expect(response.body).toEqual({
        accountId,
        email: 'rova@example.org',
        displayName: null,
        permissions: [],
        createdAt: expect.any(String) as unknown,
      });
    });

    it.each([
      [{}],
      [{ 'x-service-name': 'gateway', 'x-service-token': 'wrong' }],
      [{ 'x-service-name': 'nft', 'x-service-token': GATEWAY_TOKEN }],
    ])(
      'refuses callers without the gateway credentials %j (CA12)',
      async (headers) => {
        const response = await request(http)
          .post('/internal/v1/sessions/introspect')
          .set(headers)
          .set('x-caller-user-id', '00000000-0000-4000-8000-000000000000')
          .send({ token: 'x' })
          .expect(401);
        expect(response.body).toMatchObject({
          code: 'SERVICE_UNAUTHENTICATED',
        });
      },
    );

    it('purges revoked sessions', async () => {
      const token = await login('ana@example.org');
      await request(http)
        .post('/internal/v1/sessions/revoke')
        .set(gateway)
        .send({ token })
        .expect(204);
      expect(await app.get(AuthService).purgeSessions()).toBeGreaterThan(0);
    });

    it('never logs passwords, tokens or emails (CA15)', () => {
      const logs = logger.lines.join('\n');
      expect(logs).not.toContain(PASSWORD);
      expect(logs).not.toContain('@example.org');
      expect(logs).not.toMatch(/[A-Za-z0-9_-]{43}/);
    });
  },
);
