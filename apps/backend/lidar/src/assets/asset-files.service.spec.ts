import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  glbBytes,
  InMemoryObjectStorage,
  usdzBytes,
  webpBytes,
} from '../../test/support/in-memory-object-storage.js';
import { PublicError } from '../common/public-error.js';
import type { AssetRecord } from './asset.js';
import type { AssetRepository } from './asset-repository.js';
import { AssetFilesService, type FileDelivery } from './asset-files.service.js';
import {
  type ContentDirectory,
  ContentDirectoryUnavailableError,
} from './content-directory.js';

const ASSET_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const CONTENT_ID = '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10';
const SIZE_1K = 64;
const SIZE_2K = 128;
const POSTER_BYTES = 32;

function assetRecord(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: ASSET_ID,
    contentId: CONTENT_ID,
    objectKey1k: 'assets/a/model-1k.glb',
    objectKey2k: 'assets/a/model-2k.glb',
    posterKey: 'assets/a/poster.webp',
    usdzKey: 'assets/a/model.usdz',
    size1kBytes: SIZE_1K,
    size2kBytes: SIZE_2K,
    posterBytes: POSTER_BYTES,
    status: 'ready',
    ...overrides,
  };
}

class SingleAssetRepository implements AssetRepository {
  constructor(public asset: AssetRecord | null) {}

  findByContentId(): Promise<AssetRecord | null> {
    return Promise.reject(new Error('not used'));
  }

  findById(id: string): Promise<AssetRecord | null> {
    return Promise.resolve(this.asset?.id === id ? this.asset : null);
  }

  markReady(): Promise<AssetRecord> {
    if (!this.asset) return Promise.reject(new Error('no asset'));
    this.asset = { ...this.asset, status: 'ready' };
    return Promise.resolve(this.asset);
  }

  create(): Promise<AssetRecord> {
    return Promise.reject(new Error('not used'));
  }
}

class StubContentDirectory implements ContentDirectory {
  published = true;
  unavailable = false;

  isPublished(): Promise<boolean> {
    if (this.unavailable)
      return Promise.reject(new ContentDirectoryUnavailableError('test'));
    return Promise.resolve(this.published);
  }
}

async function expectPublicError(
  promise: Promise<unknown>,
  code: string,
  status: number,
) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(PublicError);
  expect((error as PublicError).code).toBe(code);
  expect((error as PublicError).getStatus()).toBe(status);
}

async function bodyOf(delivery: FileDelivery): Promise<Buffer> {
  if (delivery.kind !== 'content' || delivery.body === null)
    throw new Error('no body');
  return buffer(delivery.body);
}

describe('AssetFilesService', () => {
  let repository: SingleAssetRepository;
  let content: StubContentDirectory;
  let storage: InMemoryObjectStorage;
  let service: AssetFilesService;

  beforeEach(() => {
    repository = new SingleAssetRepository(assetRecord());
    content = new StubContentDirectory();
    storage = new InMemoryObjectStorage();
    service = new AssetFilesService(repository, content, storage);
  });

  describe('deliver', () => {
    const file = glbBytes(SIZE_1K);

    beforeEach(() => {
      storage.put('assets/a/model-1k.glb', file);
    });

    it('streams the whole file with type and immutable caching', async () => {
      const delivery = await service.deliver(ASSET_ID, '1k', undefined, false);
      expect(delivery).toMatchObject({
        kind: 'content',
        status: 200,
        headers: {
          'content-type': 'model/gltf-binary',
          'content-length': String(SIZE_1K),
          'accept-ranges': 'bytes',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
      await expect(bodyOf(delivery)).resolves.toEqual(file);
    });

    it('streams a byte range', async () => {
      const delivery = await service.deliver(
        ASSET_ID,
        '1k',
        'bytes=4-11',
        false,
      );
      expect(delivery).toMatchObject({
        status: 206,
        headers: {
          'content-range': `bytes 4-11/${String(SIZE_1K)}`,
          'content-length': '8',
        },
      });
      await expect(bodyOf(delivery)).resolves.toEqual(file.subarray(4, 12));
    });

    it('reports an unsatisfiable range with the object size', async () => {
      await expect(
        service.deliver(ASSET_ID, '1k', 'bytes=999-', false),
      ).resolves.toEqual({
        kind: 'unsatisfiable',
        size: SIZE_1K,
      });
    });

    it('omits the body for HEAD', async () => {
      const delivery = await service.deliver(ASSET_ID, '1k', undefined, true);
      expect(delivery).toMatchObject({
        kind: 'content',
        status: 200,
        body: null,
      });
    });

    it.each([
      ['poster', 'assets/a/poster.webp', 'image/webp'],
      ['usdz', 'assets/a/model.usdz', 'model/vnd.usdz+zip'],
      ['2k', 'assets/a/model-2k.glb', 'model/gltf-binary'],
    ])('serves %s as its media type', async (variant, key, contentType) => {
      storage.put(key, Buffer.from('bytes'));
      const delivery = await service.deliver(
        ASSET_ID,
        variant,
        undefined,
        true,
      );
      expect(delivery).toMatchObject({
        headers: { 'content-type': contentType },
      });
    });

    it.each([
      [
        'an unknown variant',
        () => service.deliver(ASSET_ID, 'raw', undefined, false),
      ],
      [
        'a malformed asset ID',
        () => service.deliver('not-a-uuid', '1k', undefined, false),
      ],
      [
        'an unknown asset',
        () =>
          service.deliver(
            '00000000-0000-4000-8000-000000000000',
            '1k',
            undefined,
            false,
          ),
      ],
      [
        'a missing object',
        () => service.deliver(ASSET_ID, '2k', undefined, false),
      ],
    ])('reports %s as a missing 3D file', async (_case, call) => {
      await expectPublicError(call(), 'MODEL3D_FILE_NOT_FOUND', 404);
    });

    it('does not serve a pending asset', async () => {
      repository.asset = assetRecord({ status: 'pending' });
      await expectPublicError(
        service.deliver(ASSET_ID, '1k', undefined, false),
        'MODEL3D_FILE_NOT_FOUND',
        404,
      );
    });

    it('does not serve an asset whose content is no longer published', async () => {
      content.published = false;
      await expectPublicError(
        service.deliver(ASSET_ID, '1k', undefined, false),
        'MODEL3D_FILE_NOT_FOUND',
        404,
      );
    });

    it('does not serve a USDZ that was not registered', async () => {
      repository.asset = assetRecord({ usdzKey: null });
      await expectPublicError(
        service.deliver(ASSET_ID, 'usdz', undefined, false),
        'MODEL3D_FILE_NOT_FOUND',
        404,
      );
    });

    it('reports an unavailable Content service', async () => {
      content.unavailable = true;
      await expectPublicError(
        service.deliver(ASSET_ID, '1k', undefined, false),
        'CONTENT_UNAVAILABLE',
        503,
      );
    });

    it('reports unavailable storage', async () => {
      storage.unavailable = true;
      await expectPublicError(
        service.deliver(ASSET_ID, '1k', undefined, false),
        'STORAGE_UNAVAILABLE',
        503,
      );
    });
  });

  describe('upload', () => {
    const upload = (
      variant: string,
      data: Buffer,
      contentType = 'application/octet-stream',
    ) =>
      service.upload(ASSET_ID, variant, {
        contentType,
        contentLength: String(data.length),
        body: Readable.from([data]),
      });

    it('stores a file at its registered key', async () => {
      repository.asset = assetRecord({ status: 'pending' });
      await expect(
        upload('1k', glbBytes(SIZE_1K), 'model/gltf-binary'),
      ).resolves.toEqual({
        assetId: ASSET_ID,
        variant: '1k',
        bytes: SIZE_1K,
        assetStatus: 'pending',
      });
      expect(storage.objects.get('assets/a/model-1k.glb')).toEqual({
        data: glbBytes(SIZE_1K),
        contentType: 'model/gltf-binary',
      });
    });

    it('marks a pending asset ready once the GLBs and poster are stored', async () => {
      repository.asset = assetRecord({ status: 'pending' });
      await upload('1k', glbBytes(SIZE_1K));
      await upload('2k', glbBytes(SIZE_2K));
      await expect(
        upload('poster', webpBytes(POSTER_BYTES)),
      ).resolves.toMatchObject({
        assetStatus: 'ready',
      });
      expect(repository.asset.status).toBe('ready');
    });

    it('fills a missing file of a ready asset but never overwrites one', async () => {
      await expect(upload('usdz', usdzBytes(48))).resolves.toMatchObject({
        assetStatus: 'ready',
      });
      await expectPublicError(
        upload('usdz', usdzBytes(48)),
        'FILE_ALREADY_STORED',
        409,
      );
    });

    it('rejects a size other than the registered one', async () => {
      await expectPublicError(
        upload('1k', glbBytes(SIZE_1K + 1)),
        'SIZE_MISMATCH',
        422,
      );
    });

    it('rejects a file whose signature does not match and stores nothing', async () => {
      await expectPublicError(
        upload('poster', glbBytes(POSTER_BYTES)),
        'INVALID_FILE',
        422,
      );
      expect(storage.objects.size).toBe(0);
    });

    it('rejects an unexpected media type', async () => {
      await expectPublicError(
        upload('1k', glbBytes(SIZE_1K), 'application/json'),
        'UNSUPPORTED_MEDIA_TYPE',
        415,
      );
    });

    it('requires a Content-Length', async () => {
      await expectPublicError(
        service.upload(ASSET_ID, '1k', {
          contentType: 'model/gltf-binary',
          contentLength: undefined,
          body: Readable.from([glbBytes(SIZE_1K)]),
        }),
        'LENGTH_REQUIRED',
        411,
      );
    });

    it('rejects a USDZ above the ceiling', async () => {
      await expectPublicError(
        service.upload(ASSET_ID, 'usdz', {
          contentType: 'model/vnd.usdz+zip',
          contentLength: String(65 * 1024 * 1024),
          body: Readable.from([]),
        }),
        'FILE_TOO_LARGE',
        413,
      );
    });

    it('rejects a USDZ when none was registered', async () => {
      repository.asset = assetRecord({ usdzKey: null });
      await expectPublicError(
        upload('usdz', usdzBytes(48)),
        'USDZ_NOT_REGISTERED',
        409,
      );
    });

    it('rejects an unknown asset or variant', async () => {
      repository.asset = null;
      await expectPublicError(
        upload('1k', glbBytes(SIZE_1K)),
        'ASSET_NOT_FOUND',
        404,
      );
      await expectPublicError(
        upload('raw', glbBytes(SIZE_1K)),
        'VARIANT_UNKNOWN',
        404,
      );
    });
  });
});
