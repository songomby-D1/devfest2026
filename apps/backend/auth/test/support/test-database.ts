import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';

const SERVICE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PRISMA_CLI = join(
  dirname(createRequire(import.meta.url).resolve('prisma/package.json')),
  'build',
  'index.js',
);

/**
 * URL of a PostgreSQL role allowed to create databases. Each run creates and drops its own
 * database, so the suite never touches shared data.
 */
export const adminDatabaseUrl = process.env['AUTH_TEST_DATABASE_URL'];

/** CI sets this so that a missing database fails the run instead of skipping the suite. */
export const databaseRequired = process.env['REQUIRE_DB_TESTS'] === 'true';

export interface TestDatabase {
  readonly url: string;
  query<Row extends pg.QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<Row[]>;
  drop(): Promise<void>;
}

export async function createTestDatabase(
  adminUrl: string,
): Promise<TestDatabase> {
  const name = `auth_test_${randomBytes(6).toString('hex')}`;
  await withClient(adminUrl, (client) =>
    client.query(`CREATE DATABASE "${name}"`),
  );
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  await promisify(execFile)(
    process.execPath,
    [PRISMA_CLI, 'migrate', 'deploy'],
    {
      cwd: SERVICE_ROOT,
      env: { ...process.env, MIGRATION_DATABASE_URL: url.toString() },
    },
  );
  return {
    url: url.toString(),
    async query<Row extends pg.QueryResultRow>(
      sql: string,
      values: unknown[] = [],
    ): Promise<Row[]> {
      return withClient(url.toString(), async (client) => {
        const result = await client.query<Row>(sql, values);
        return result.rows;
      });
    },
    drop: () =>
      withClient(adminUrl, async (client) => {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      }),
  };
}

async function withClient<T>(
  connectionString: string,
  action: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}
