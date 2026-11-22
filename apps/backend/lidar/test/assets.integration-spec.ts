import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_TOKEN_HEADER } from '../src/assets/admin-token.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  FakeContentDirectory,
  startPostgres,
  TEST_ADMIN_TOKEN,
  TEST_ASSET_BASE_PATH,
} from './support/test-app.js';

const PUBLISHED_ID = '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10';
const UNPUBLISHED_ID = '5d2a9e47-1c3b-4f80-8a6e-2b7c9d0e1f23';
const OBJECT_KEY_MARKER = 'private-object-key';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function registration(
  contentId: string,
  status: 'pending' | 'ready' = 'ready',
): Record<string, unknown> {
  return {
    contentId,
    objectKey1k: `lidar/${OBJECT_KEY_MARKER}/model-1k.glb`,
    objectKey2k: `lidar/${OBJECT_KEY_MARKER}/model-2k.glb`,
    posterKey: `lidar/${OBJECT_KEY_MARKER}/poster.webp`,
    usdzKey: `lidar/${OBJECT_KEY_MARKER}/model.usdz`,
    size1kBytes: 74_000,
    size2kBytes: 148_000,
    posterBytes: 12_000,
    status,
  };
}

function expectNoInternalDetails(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(OBJECT_KEY_MARKER);
  expect(serialized).not.toContain(TEST_ADMIN_TOKEN);
  expect(serialized).not.toMatch(/postgres(ql)?:\/\//);
}

describe('LiDAR service over HTTP and PostgreSQL', () => {
  let postgres: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  const contentDirectory = new FakeContentDirectory();

  beforeAll(async () => {
    postgres = await startPostgres();
    contentDirectory.published.add(PUBLISHED_ID);
    app = await createTestApp(postgres.getConnectionUri(), contentDirectory);
  });

  afterAll(async () => {
    await app.close();
    await postgres.stop();
  });

  beforeEach(async () => {
    await app.get(PrismaService).asset3d.deleteMany();
  });

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/assets')
      .set(ADMIN_TOKEN_HEADER, TEST_ADMIN_TOKEN)
      .send(body);

  it('reports health when the database answers', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200, { status: 'ok' });
  });

  it('associates a ready asset and returns delivery paths only', async () => {
    const created = await register(registration(PUBLISHED_ID)).expect(201);
    const { id: assetId, ...registered } = created.body as { id: string };
    expect(assetId).toMatch(UUID_PATTERN);
    expect(registered).toEqual({ contentId: PUBLISHED_ID, status: 'ready' });
    expectNoInternalDetails(created.body);

    const lookup = await request(app.getHttpServer())
      .get(`/assets/by-content/${PUBLISHED_ID}`)
      .expect(200);

    expect(lookup.body).toEqual({
      contentId: PUBLISHED_ID,
      status: 'ready',
      variants: {
        '1k': { url: `${TEST_ASSET_BASE_PATH}/${assetId}/1k`, bytes: 74_000 },
        '2k': { url: `${TEST_ASSET_BASE_PATH}/${assetId}/2k`, bytes: 148_000 },
      },
      poster: { url: `${TEST_ASSET_BASE_PATH}/${assetId}/poster` },
      ar: null,
    });
    expectNoInternalDetails(lookup.body);
  });

  it('answers "none" for content without an asset', async () => {
    await request(app.getHttpServer())
      .get(`/assets/by-content/${UNPUBLISHED_ID}`)
      .expect(200, { contentId: UNPUBLISHED_ID, status: 'none' });
  });

  it('answers "none" for a pending asset', async () => {
    await register(registration(PUBLISHED_ID, 'pending')).expect(201);

    await request(app.getHttpServer())
      .get(`/assets/by-content/${PUBLISHED_ID}`)
      .expect(200, { contentId: PUBLISHED_ID, status: 'none' });
  });

  it('rejects unknown or unpublished content with 422 and stores nothing', async () => {
    const response = await register(registration(UNPUBLISHED_ID)).expect(422);

    expectNoInternalDetails(response.body);
    expect(await app.get(PrismaService).asset3d.count()).toBe(0);
  });

  it('rejects a second asset for the same content with 409', async () => {
    await register(registration(PUBLISHED_ID)).expect(201);
    const response = await register(registration(PUBLISHED_ID)).expect(409);

    expectNoInternalDetails(response.body);
  });

  it('rejects registration without the admin token', async () => {
    await request(app.getHttpServer())
      .post('/assets')
      .send(registration(PUBLISHED_ID))
      .expect(401);
    await request(app.getHttpServer())
      .post('/assets')
      .set(ADMIN_TOKEN_HEADER, 'wrong-token')
      .send(registration(PUBLISHED_ID))
      .expect(401);
  });

  it('rejects invalid bodies and content ids with 400', async () => {
    const response = await register({
      ...registration(PUBLISHED_ID),
      objectKey1k: '../escape.glb',
    }).expect(400);
    expectNoInternalDetails(response.body);

    await request(app.getHttpServer())
      .get('/assets/by-content/not-a-uuid')
      .expect(400);
  });
});
