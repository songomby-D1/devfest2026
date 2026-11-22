import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  glbBytes,
  InMemoryObjectStorage,
  usdzBytes,
  webpBytes,
} from '../../test/support/in-memory-object-storage.js';
import {
  APP_CONFIG,
  type AppConfig,
  StorageCredentials,
} from '../config/app-config.js';
import { OBJECT_STORAGE } from '../storage/object-storage.js';
import type { AssetRecord } from './asset.js';
import { ADMIN_TOKEN_HEADER, AdminTokenGuard } from './admin-token.guard.js';
import { AssetFilesController } from './asset-files.controller.js';
import { AssetFilesService } from './asset-files.service.js';
import { ASSET_REPOSITORY, type AssetRepository } from './asset-repository.js';
import {
  CONTENT_DIRECTORY,
  type ContentDirectory,
} from './content-directory.js';

// HTTP-level test of the file routes with in-memory fakes; the PostgreSQL
// round trip is covered by test/asset-files.integration-spec.ts.

const ADMIN_TOKEN = 'controller-spec-admin-token-0123456789';
const ASSET_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const CONTENT_ID = '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10';
const FILES = {
  '1k': { bytes: glbBytes(1500), type: 'model/gltf-binary' },
  '2k': { bytes: glbBytes(3000), type: 'model/gltf-binary' },
  poster: { bytes: webpBytes(400), type: 'image/webp' },
  usdz: { bytes: usdzBytes(800), type: 'model/vnd.usdz+zip' },
} as const;
type Variant = keyof typeof FILES;

const config: AppConfig = {
  port: 0,
  databaseUrl: 'postgresql://unused',
  contentServiceUrl: 'http://unused',
  publicAssetBasePath: '/api/lidar/files',
  adminToken: ADMIN_TOKEN,
  storage: {
    endpoint: 'http://unused',
    region: 'us-east-1',
    bucket: 'unused',
    prefix: '',
    forcePathStyle: true,
    credentials: new StorageCredentials('unused', 'unused'),
  },
};

function pendingAsset(): AssetRecord {
  return {
    id: ASSET_ID,
    contentId: CONTENT_ID,
    objectKey1k: 'k/model-1k.glb',
    objectKey2k: 'k/model-2k.glb',
    posterKey: 'k/poster.webp',
    usdzKey: 'k/model.usdz',
    size1kBytes: FILES['1k'].bytes.length,
    size2kBytes: FILES['2k'].bytes.length,
    posterBytes: FILES.poster.bytes.length,
    status: 'pending',
  };
}

class MemoryRepository implements AssetRepository {
  asset: AssetRecord = pendingAsset();

  findByContentId(): Promise<AssetRecord | null> {
    return Promise.resolve(this.asset);
  }

  findById(id: string): Promise<AssetRecord | null> {
    return Promise.resolve(id === this.asset.id ? this.asset : null);
  }

  markReady(): Promise<AssetRecord> {
    this.asset = { ...this.asset, status: 'ready' };
    return Promise.resolve(this.asset);
  }

  create(): Promise<AssetRecord> {
    return Promise.reject(new Error('not used'));
  }
}

class MemoryContentDirectory implements ContentDirectory {
  published = true;

  isPublished(): Promise<boolean> {
    return Promise.resolve(this.published);
  }
}

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

describe('AssetFilesController over HTTP', () => {
  let app: INestApplication<App>;
  const repository = new MemoryRepository();
  const content = new MemoryContentDirectory();
  const storage = new InMemoryObjectStorage();

  const http = () => request(app.getHttpServer());
  const upload = (variant: Variant, body: Buffer = FILES[variant].bytes) =>
    http()
      .put(`/assets/${ASSET_ID}/files/${variant}`)
      .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN)
      .set('content-type', FILES[variant].type)
      .send(body);
  const download = (variant: string) =>
    http()
      .get(`/files/${ASSET_ID}/${variant}`)
      .buffer(true)
      .parse(binaryParser);
  const uploadAll = async () => {
    for (const variant of Object.keys(FILES) as Variant[]) {
      await upload(variant).expect(201);
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AssetFilesController],
      providers: [
        AssetFilesService,
        AdminTokenGuard,
        { provide: APP_CONFIG, useValue: config },
        { provide: ASSET_REPOSITORY, useValue: repository },
        { provide: CONTENT_DIRECTORY, useValue: content },
        { provide: OBJECT_STORAGE, useValue: storage },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repository.asset = pendingAsset();
    content.published = true;
    storage.objects.clear();
    storage.unavailable = false;
  });

  it('stores every variant, readies the asset and streams each file', async () => {
    await uploadAll();
    expect(repository.asset.status).toBe('ready');
    for (const [variant, file] of Object.entries(FILES)) {
      const response = await download(variant).expect(200);
      expect(response.headers).toMatchObject({
        'content-type': file.type,
        'content-length': String(file.bytes.length),
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      });
      expect(response.body).toEqual(file.bytes);
    }
  });

  it('serves a byte range with 206', async () => {
    await uploadAll();
    const response = await download('1k')
      .set('range', 'bytes=10-19')
      .expect(206);
    expect(response.headers['content-range']).toBe('bytes 10-19/1500');
    expect(response.body).toEqual(FILES['1k'].bytes.subarray(10, 20));
  });

  it('answers an unsatisfiable range with 416 and the error shape', async () => {
    await uploadAll();
    const response = await http()
      .get(`/files/${ASSET_ID}/1k`)
      .set('range', 'bytes=5000-')
      .set('x-request-id', 'gw-416')
      .expect(416);
    expect(response.headers['content-range']).toBe('bytes */1500');
    expect(response.body).toEqual({
      code: 'RANGE_NOT_SATISFIABLE',
      message: 'Requested range is outside the file',
      requestId: 'gw-416',
    });
  });

  it('answers HEAD with headers only', async () => {
    await uploadAll();
    const response = await http().head(`/files/${ASSET_ID}/poster`).expect(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['content-length']).toBe('400');
  });

  it('returns the agreed error shape for a missing object', async () => {
    await uploadAll();
    storage.objects.delete('k/model-2k.glb');
    const response = await http()
      .get(`/files/${ASSET_ID}/2k`)
      .set('x-request-id', 'gw-404')
      .expect(404);
    expect(response.body).toEqual({
      code: 'MODEL3D_FILE_NOT_FOUND',
      message: '3D file not found',
      requestId: 'gw-404',
    });
    expect(response.headers['x-request-id']).toBe('gw-404');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('replaces an unsafe request ID instead of echoing it', async () => {
    const response = await http()
      .get(`/files/${ASSET_ID}/1k`)
      .set('x-request-id', '<script>')
      .expect(404);
    const { requestId } = response.body as { requestId: string };
    expect(requestId).not.toContain('<');
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('serves nothing for an unpublished item', async () => {
    await uploadAll();
    content.published = false;
    const response = await http().get(`/files/${ASSET_ID}/1k`).expect(404);
    expect(response.body).toMatchObject({ code: 'MODEL3D_FILE_NOT_FOUND' });
  });

  it('reports a storage outage as 503 without details', async () => {
    await uploadAll();
    storage.unavailable = true;
    const response = await http().get(`/files/${ASSET_ID}/1k`).expect(503);
    expect(response.body).toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('requires the service token to upload', async () => {
    const response = await http()
      .put(`/assets/${ASSET_ID}/files/1k`)
      .set('content-type', 'model/gltf-binary')
      .send(FILES['1k'].bytes)
      .expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(storage.objects.size).toBe(0);
  });

  it('rejects a file whose signature does not match', async () => {
    const response = await upload('1k', Buffer.alloc(1500)).expect(422);
    expect(response.body).toMatchObject({ code: 'INVALID_FILE' });
    expect(storage.objects.size).toBe(0);
  });

  it('never overwrites a file of a ready asset', async () => {
    await uploadAll();
    const response = await upload('poster').expect(409);
    expect(response.body).toMatchObject({ code: 'FILE_ALREADY_STORED' });
  });
});
