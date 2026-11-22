import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  OTHER_ID,
  OWNER_ID,
  createBody,
  testConfig,
} from '../support/fixtures';
import { createTestApp, gatewayHeaders } from '../support/test-app';

const POSTGRES_IMAGE = 'postgres:18.6';
const SERVICE_ROOT = join(__dirname, '..', '..');
const DATABASE = 'content';

jest.setTimeout(180_000);

/**
 * Mirrors INFRA-01 (D04): a migration role that owns the database and a
 * runtime role limited to data access. The application runs as the latter.
 * Each statement runs on its own, since CREATE DATABASE refuses transactions.
 */
const SERVER_STATEMENTS = [
  "CREATE ROLE content_migrator LOGIN PASSWORD 'migrator-pw'",
  "CREATE ROLE content_runtime LOGIN PASSWORD 'runtime-pw'",
  `CREATE DATABASE ${DATABASE} OWNER content_migrator`,
  `REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC`,
  `GRANT CONNECT, TEMPORARY ON DATABASE ${DATABASE} TO content_runtime`,
];
const DATABASE_STATEMENTS = [
  'GRANT USAGE ON SCHEMA public TO content_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE content_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO content_runtime',
  'ALTER DEFAULT PRIVILEGES FOR ROLE content_migrator IN SCHEMA public GRANT USAGE ON TYPES TO content_runtime',
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

describe('content-service with PostgreSQL (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    await runSql(container, 'postgres', SERVER_STATEMENTS);
    await runSql(container, DATABASE, DATABASE_STATEMENTS);

    await promisify(execFile)(
      'node_modules/.bin/prisma',
      ['migrate', 'deploy'],
      {
        cwd: SERVICE_ROOT,
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: urlFor(
            container,
            'content_migrator',
            'migrator-pw',
          ),
        },
      },
    );

    app = await createTestApp(
      testConfig(urlFor(container, 'content_runtime', 'runtime-pw')),
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  const http = () => request(app.getHttpServer());

  it('creates the author, item and description in one write', async () => {
    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    expect(response.status).toBe(201);
    const id = (response.body as { id: string }).id;

    const row = await prisma.item.findUniqueOrThrow({
      where: { id },
      include: { author: true, description: true },
    });
    expect(row).toMatchObject({
      ownerId: OWNER_ID,
      title: 'Lamba mena',
      kind: 'textile',
      publicationStatus: 'draft',
      submissionStatus: 'in_review',
      claimStatus: 'unreviewed',
      author: { name: 'Rasoa', community: 'Merina weavers' },
      description: {
        text: 'A silk burial shroud woven in the highlands.',
        claimStatus: 'unreviewed',
      },
    });

    const read = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID));
    expect(read.status).toBe(200);
    expect(read.body).toEqual(response.body);
  });

  it('stores nothing when the input is invalid', async () => {
    const before = await prisma.author.count();

    const response = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody({ description: '' }));

    expect(response.status).toBe(400);
    expect(await prisma.author.count()).toBe(before);
  });

  it('hides a draft from other users and shows it once published', async () => {
    const created = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    const id = (created.body as { id: string }).id;

    const hidden = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OTHER_ID));
    expect(hidden.status).toBe(404);

    await prisma.item.update({
      where: { id },
      data: { publicationStatus: 'published' },
    });
    const guest = await http()
      .get(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(null));
    expect(guest.status).toBe(200);
  });

  it('reopens the changed claims on edit and refuses edits once published', async () => {
    const created = await http()
      .post('/internal/v1/items')
      .set(gatewayHeaders(OWNER_ID))
      .send(createBody());
    const id = (created.body as { id: string }).id;
    await prisma.item.update({
      where: { id },
      data: {
        claimStatus: 'verified',
        description: { update: { claimStatus: 'uncertain' } },
      },
    });

    const edited = await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ description: 'Corrected description.', technique: null });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      description: 'Corrected description.',
      creator: { technique: null },
      claims: { item: 'unreviewed', description: 'unreviewed' },
    });
    const editedAt = (edited.body as { updatedAt: string }).updatedAt;
    expect(Date.parse(editedAt)).toBeGreaterThan(
      Date.parse((created.body as { updatedAt: string }).updatedAt),
    );

    await prisma.item.update({
      where: { id },
      data: { publicationStatus: 'published' },
    });
    const refused = await http()
      .patch(`/internal/v1/items/${id}`)
      .set(gatewayHeaders(OWNER_ID))
      .send({ title: 'Another title' });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'ITEM_PUBLISHED' });
    expect((await prisma.item.findUniqueOrThrow({ where: { id } })).title).toBe(
      'Lamba mena',
    );
  });

  it('runs with a runtime role that cannot change the schema (D04)', async () => {
    await expect(
      prisma.$executeRawUnsafe('DROP TABLE descriptions'),
    ).rejects.toThrow();
  });
});
