import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { Logger } from '@nestjs/common';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FakeContent } from '../support/fake-content';
import {
  createTestApp,
  gatewayHeaders,
  OWNER_ID,
  type TestApp,
} from '../support/test-app';

const POSTGRES_IMAGE = 'postgres:18.6';
const SERVICE_ROOT = join(__dirname, '..', '..');
// Resolved through Node because the root workspace may hoist prisma out of the service.
const PRISMA_CLI = join(
  dirname(require.resolve('prisma/package.json')),
  'build',
  'index.js',
);
const DATABASE = 'nft';
const ITEM = '3f2b8c1e-6a4d-4f7b-9c2e-1a2b3c4d5e6f';
const SECOND_ITEM = '7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const FIRST_MINT = 'first-mint-request-01';

jest.setTimeout(180_000);

/**
 * Mirrors INFRA-01 (D04): a migration role that owns the database and a
 * runtime role limited to data access. The application runs as the latter.
 */
const SERVER_STATEMENTS = [
  "CREATE ROLE nft_migrator LOGIN PASSWORD 'migrator-pw'",
  "CREATE ROLE nft_runtime LOGIN PASSWORD 'runtime-pw'",
  `CREATE DATABASE ${DATABASE} OWNER nft_migrator`,
  `REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC`,
  `GRANT CONNECT, TEMPORARY ON DATABASE ${DATABASE} TO nft_runtime`,
];
const DATABASE_STATEMENTS = [
  'GRANT USAGE ON SCHEMA public TO nft_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE nft_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nft_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE nft_migrator IN SCHEMA public GRANT USAGE ON TYPES TO nft_runtime',
];

async function runSql(
  container: StartedPostgreSqlContainer,
  database: string,
  statements: readonly string[],
): Promise<void> {
  const result = await container.exec([
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    ...statements.flatMap((statement) => ['-c', statement]),
  ]);
  if (result.exitCode !== 0) throw new Error(`psql failed: ${result.output}`);
}

function urlFor(
  container: StartedPostgreSqlContainer,
  user: string,
  password: string,
): string {
  return `postgresql://${user}:${password}@${container.getHost()}:${String(
    container.getPort(),
  )}/${DATABASE}`;
}

describe('nft-service mint with PostgreSQL (Testcontainers)', () => {
  const content = new FakeContent();
  let container: StartedPostgreSqlContainer;
  let runtimeUrl: string;
  let t: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
    const contentUrl = await content.start();
    for (const id of [ITEM, SECOND_ITEM]) {
      content.items.set(id, {
        ownerId: OWNER_ID,
        publicationStatus: 'published',
      });
    }

    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    await runSql(container, 'postgres', SERVER_STATEMENTS);
    await runSql(container, DATABASE, DATABASE_STATEMENTS);
    await promisify(execFile)(
      process.execPath,
      [PRISMA_CLI, 'migrate', 'deploy'],
      {
        cwd: SERVICE_ROOT,
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: urlFor(
            container,
            'nft_migrator',
            'migrator-pw',
          ),
        },
      },
    );

    runtimeUrl = urlFor(container, 'nft_runtime', 'runtime-pw');
    t = await createTestApp({ contentUrl, databaseUrl: runtimeUrl });
    prisma = t.app.get(PrismaService);
  });

  afterAll(async () => {
    await t.app.close();
    await container.stop();
    await content.stop();
    jest.restoreAllMocks();
  });

  const mint = (contentId: string, key: string) =>
    request(t.app.getHttpServer())
      .post('/internal/v1/mints')
      .set(gatewayHeaders(OWNER_ID))
      .set('idempotency-key', key)
      .send({ contentId });

  it('stores the request, then its transaction and token', async () => {
    const started = await mint(ITEM, FIRST_MINT);
    expect(started.status).toBe(202);
    await t.processor.whenIdle();

    const row = await prisma.mintRequest.findUniqueOrThrow({
      where: { id: (started.body as { mintId: string }).mintId },
    });
    expect(row).toMatchObject({
      contentId: ITEM,
      requesterId: OWNER_ID,
      idempotencyKey: FIRST_MINT,
      status: 'confirmed',
      attempts: 0,
      chainId: 43113,
      tokenId: '1',
      tokenUri: expect.stringMatching(/^ipfs:\/\//) as string,
      masterHash: expect.stringMatching(/^0x[0-9a-f]{64}$/) as string,
      txHash: expect.stringMatching(/^0x/) as string,
      requestId: 'req-mint-1',
    });
    expect(row.submittedAt).toBeInstanceOf(Date);
    expect(row.confirmedAt).toBeInstanceOf(Date);
  });

  it('resolves concurrent requests to one row per key and one live mint per item', async () => {
    t.chain.hold = true;
    const sameKey = await Promise.all(
      Array.from({ length: 10 }, () =>
        mint(SECOND_ITEM, 'concurrent-key-0001'),
      ),
    );
    const otherKeys = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        mint(SECOND_ITEM, `concurrent-key-1${String(i).padStart(3, '0')}`),
      ),
    );
    await t.processor.whenIdle();

    expect(sameKey.filter((r) => r.status === 202)).toHaveLength(1);
    expect(sameKey.every((r) => r.status === 202 || r.status === 200)).toBe(
      true,
    );
    expect(
      new Set(sameKey.map((r) => (r.body as { mintId: string }).mintId)).size,
    ).toBe(1);
    expect(otherKeys.every((r) => r.status === 409)).toBe(true);
    expect(
      await prisma.mintRequest.count({ where: { contentId: SECOND_ITEM } }),
    ).toBe(1);
    t.chain.hold = false;
  });

  it('enforces one live mint per item in the database itself', async () => {
    const base = {
      contentId: ITEM,
      requesterId: OWNER_ID,
      chainId: 43113,
      contractAddress: t.chain.network.contractAddress,
      requestId: 'req-db',
    };
    // ITEM is confirmed by the first test: another live row is refused...
    await expect(
      prisma.mintRequest.create({
        data: { ...base, idempotencyKey: 'db-key-000000000001' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    // ...a failed one is allowed, and a confirmed one needs its token.
    await expect(
      prisma.mintRequest.create({
        data: {
          ...base,
          idempotencyKey: 'db-key-000000000002',
          status: 'failed',
          failureCode: 'CHAIN_UNAVAILABLE',
        },
      }),
    ).resolves.toMatchObject({ status: 'failed' });
    await expect(
      prisma.mintRequest.create({
        data: {
          ...base,
          contentId: '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b',
          idempotencyKey: 'db-key-000000000003',
          status: 'confirmed',
        },
      }),
    ).rejects.toThrow();
  });

  it('resumes pending requests from the database after a restart', async () => {
    const pending = await prisma.mintRequest.findFirstOrThrow({
      where: { contentId: SECOND_ITEM },
    });
    expect(pending.status).toBe('pending');
    expect(pending.txHash).not.toBeNull();

    await t.processor.resumePending();
    await t.processor.whenIdle();

    const row = await prisma.mintRequest.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(row).toMatchObject({ status: 'confirmed', txHash: pending.txHash });
  });

  it('runs as a runtime role that cannot change the schema', async () => {
    await expect(
      prisma.$executeRawUnsafe('DROP TABLE mint_requests'),
    ).rejects.toThrow();
  });
});
