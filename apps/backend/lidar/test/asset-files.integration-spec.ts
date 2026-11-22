import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_TOKEN_HEADER } from '../src/assets/admin-token.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  glbBytes,
  InMemoryObjectStorage,
  usdzBytes,
  webpBytes,
} from './support/in-memory-object-storage.js';
import {
  createTestApp,
  FakeContentDirectory,
  startPostgres,
  TEST_ADMIN_TOKEN,
  TEST_ASSET_BASE_PATH,
} from './support/test-app.js';

const CONTENT_ID = '3e7a1c52-9b4d-4f6e-8a20-6c5d4e3f2a1b';
const KEY_MARKER = 'private-object-key';
const FILES = {
  '1k': { bytes: glbBytes(2048), type: 'model/gltf-binary' },
  '2k': { bytes: glbBytes(4096), type: 'model/gltf-binary' },
  poster: { bytes: webpBytes(512), type: 'image/webp' },
  usdz: { bytes: usdzBytes(1024), type: 'model/vnd.usdz+zip' },
} as const;
type Variant = keyof typeof FILES;

// Superagent hands the raw response stream to custom parsers at runtime.
function binaryParser(
  response: unknown,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const stream = response as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

describe('3D file storage and delivery over HTTP', () => {
  let postgres: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  const contentDirectory = new FakeContentDirectory();
  const storage = new InMemoryObjectStorage();
  let assetId: string;

  const http = () => request(app.getHttpServer());
  const upload = (variant: Variant, body: Buffer = FILES[variant].bytes) =>
    http()
      .put(`/assets/${assetId}/files/${variant}`)
      .set(ADMIN_TOKEN_HEADER, TEST_ADMIN_TOKEN)
      .set('content-type', FILES[variant].type)
      .send(body);
  const download = (variant: string) =>
    http().get(`/files/${assetId}/${variant}`).buffer(true).parse(binaryParser);

  beforeAll(async () => {
    postgres = await startPostgres();
    app = await createTestApp(
      postgres.getConnectionUri(),
      contentDirectory,
      storage,
    );
  });

  afterAll(async () => {
    await app.close();
    await postgres.stop();
  });

  beforeEach(async () => {
    await app.get(PrismaService).asset3d.deleteMany();
    storage.objects.clear();
    contentDirectory.published.clear();
    contentDirectory.published.add(CONTENT_ID);
    const registered = await http()
      .post('/assets')
      .set(ADMIN_TOKEN_HEADER, TEST_ADMIN_TOKEN)
      .send({
        contentId: CONTENT_ID,
        objectKey1k: `${KEY_MARKER}/model-1k.glb`,
        objectKey2k: `${KEY_MARKER}/model-2k.glb`,
        posterKey: `${KEY_MARKER}/poster.webp`,
        usdzKey: `${KEY_MARKER}/model.usdz`,
        size1kBytes: FILES['1k'].bytes.length,
        size2kBytes: FILES['2k'].bytes.length,
        posterBytes: FILES.poster.bytes.length,
        status: 'pending',
      })
      .expect(201);
    assetId = (registered.body as { id: string }).id;
  });

  async function uploadAll(): Promise<void> {
    for (const variant of Object.keys(FILES) as Variant[]) {
      await upload(variant).expect(201);
    }
  }

  it('uploads the 3D-04a outputs, marks the asset ready and serves every file', async () => {
    await upload('1k').expect(201, {
      assetId,
      variant: '1k',
      bytes: FILES['1k'].bytes.length,
      assetStatus: 'pending',
    });
    await upload('2k').expect(201);
    const poster = await upload('poster').expect(201);
    expect(poster.body).toMatchObject({ assetStatus: 'ready' });
    await upload('usdz').expect(201);

    const display = await http()
      .get(`/assets/by-content/${CONTENT_ID}`)
      .expect(200);
    expect(display.body).toMatchObject({
      status: 'ready',
      variants: { '1k': { url: `${TEST_ASSET_BASE_PATH}/${assetId}/1k` } },
    });

    for (const [variant, file] of Object.entries(FILES)) {
      const response = await download(variant).expect(200);
      expect(response.headers['content-type']).toBe(file.type);
      expect(response.headers['content-length']).toBe(
        String(file.bytes.length),
      );
      expect(response.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(response.headers['accept-ranges']).toBe('bytes');
      expect(response.body).toEqual(file.bytes);
    }
    // Objects land under their registered keys, scoped by the in-memory store.
    expect(storage.objects.has(`${KEY_MARKER}/model-1k.glb`)).toBe(true);
  });

  it('answers range requests with 206 and 416', async () => {
    await uploadAll();
    const partial = await download('2k')
      .set('range', 'bytes=100-199')
      .expect(206);
    expect(partial.headers['content-range']).toBe(
      `bytes 100-199/${String(FILES['2k'].bytes.length)}`,
    );
    expect(partial.body).toEqual(FILES['2k'].bytes.subarray(100, 200));

    const suffix = await download('2k').set('range', 'bytes=-10').expect(206);
    expect(suffix.body).toEqual(FILES['2k'].bytes.subarray(-10));

    const unsatisfiable = await http()
      .get(`/files/${assetId}/2k`)
      .set('range', 'bytes=999999-')
      .set('x-request-id', 'req-416')
      .expect(416);
    expect(unsatisfiable.headers['content-range']).toBe(
      `bytes */${String(FILES['2k'].bytes.length)}`,
    );
    expect(unsatisfiable.body).toEqual({
      code: 'RANGE_NOT_SATISFIABLE',
      message: 'Requested range is outside the file',
      requestId: 'req-416',
    });
  });

  it('answers HEAD without a body', async () => {
    await uploadAll();
    const response = await http().head(`/files/${assetId}/1k`).expect(200);
    expect(response.headers['content-length']).toBe(
      String(FILES['1k'].bytes.length),
    );
  });

  it('returns the public error shape for a missing object so the frontend can fall back', async () => {
    await uploadAll();
    storage.objects.delete(`${KEY_MARKER}/model-2k.glb`);
    const response = await http()
      .get(`/files/${assetId}/2k`)
      .set('x-request-id', 'req-missing')
      .expect(404);
    expect(response.body).toEqual({
      code: 'MODEL3D_FILE_NOT_FOUND',
      message: '3D file not found',
      requestId: 'req-missing',
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toContain(KEY_MARKER);
  });

  it('serves nothing before the asset is ready', async () => {
    await upload('1k').expect(201);
    const response = await http().get(`/files/${assetId}/1k`).expect(404);
    expect(response.body).toMatchObject({ code: 'MODEL3D_FILE_NOT_FOUND' });
    expect(typeof (response.body as { requestId: unknown }).requestId).toBe(
      'string',
    );
  });

  it('stops serving files once the content is unpublished', async () => {
    await uploadAll();
    contentDirectory.published.delete(CONTENT_ID);
    await http().get(`/files/${assetId}/1k`).expect(404);
  });

  it('rejects uploads without the service token in the public error shape', async () => {
    const response = await http()
      .put(`/assets/${assetId}/files/1k`)
      .set('content-type', 'model/gltf-binary')
      .send(FILES['1k'].bytes)
      .expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(storage.objects.size).toBe(0);
  });

  it('rejects a file that does not match its variant', async () => {
    const response = await upload(
      'poster',
      webpBytes(FILES.poster.bytes.length).fill(0),
    ).expect(422);
    expect(response.body).toMatchObject({ code: 'INVALID_FILE' });
    expect(storage.objects.size).toBe(0);
  });

  it('keeps stored files of a ready asset immutable', async () => {
    await uploadAll();
    const response = await upload('1k').expect(409);
    expect(response.body).toMatchObject({ code: 'FILE_ALREADY_STORED' });
  });
});
