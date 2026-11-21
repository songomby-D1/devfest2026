import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import type { ContentDirectory } from '../../src/assets/content-directory.js';
import { CONTENT_DIRECTORY } from '../../src/assets/content-directory.js';
import type { AppConfig } from '../../src/config/app-config.js';

const POSTGRES_IMAGE = 'postgres:18.6';
const SERVICE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const TEST_ADMIN_TOKEN = 'integration-admin-token-0123456789abcdef';
export const TEST_ASSET_BASE_PATH = '/api/lidar/files';

export class FakeContentDirectory implements ContentDirectory {
  readonly published = new Set<string>();

  isPublished(contentId: string): Promise<boolean> {
    return Promise.resolve(this.published.has(contentId));
  }
}

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  await promisify(execFile)('node_modules/.bin/prisma', ['migrate', 'deploy'], {
    cwd: SERVICE_ROOT,
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: container.getConnectionUri(),
    },
  });
  return container;
}

export async function createTestApp(
  databaseUrl: string,
  contentDirectory: ContentDirectory,
): Promise<INestApplication<App>> {
  const config: AppConfig = {
    port: 0,
    databaseUrl,
    contentServiceUrl: 'http://content.invalid',
    publicAssetBasePath: TEST_ASSET_BASE_PATH,
    adminToken: TEST_ADMIN_TOKEN,
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
  })
    .overrideProvider(CONTENT_DIRECTORY)
    .useValue(contentDirectory)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.useLogger(false);
  await app.init();
  return app;
}
