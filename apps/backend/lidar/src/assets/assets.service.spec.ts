import { beforeEach, describe, expect, it } from 'vitest';
import { type AppConfig, StorageCredentials } from '../config/app-config.js';
import {
  AssetAlreadyRegisteredError,
  type AssetRecord,
  ContentNotPublishedError,
  type NewAsset,
} from './asset.js';
import type { AssetRepository } from './asset-repository.js';
import { AssetsService } from './assets.service.js';
import type { ContentDirectory } from './content-directory.js';
import type { RegisterAssetDto } from './register-asset.dto.js';

const PUBLISHED_ID = '0b8f6c1e-4a52-4d36-9f4c-3c1f2a7e9d10';
const UNPUBLISHED_ID = '5d2a9e47-1c3b-4f80-8a6e-2b7c9d0e1f23';

const config: AppConfig = {
  port: 3000,
  databaseUrl: 'postgresql://unused',
  contentServiceUrl: 'http://unused',
  publicAssetBasePath: '/api/lidar/files',
  adminToken: 'x'.repeat(32),
  storage: {
    endpoint: 'http://unused',
    region: 'us-east-1',
    bucket: 'unused',
    prefix: '',
    forcePathStyle: true,
    credentials: new StorageCredentials('unused', 'unused'),
  },
  generation: null,
};

class InMemoryAssetRepository implements AssetRepository {
  readonly records = new Map<string, AssetRecord>();

  findByContentId(contentId: string): Promise<AssetRecord | null> {
    return Promise.resolve(this.records.get(contentId) ?? null);
  }

  findById(): Promise<AssetRecord | null> {
    return Promise.reject(new Error('not used'));
  }

  markReady(): Promise<AssetRecord> {
    return Promise.reject(new Error('not used'));
  }

  create(asset: NewAsset): Promise<AssetRecord> {
    if (this.records.has(asset.contentId))
      return Promise.reject(new AssetAlreadyRegisteredError());
    const record = { ...asset, id: `asset-${String(this.records.size + 1)}` };
    this.records.set(asset.contentId, record);
    return Promise.resolve(record);
  }
}

class FakeContentDirectory implements ContentDirectory {
  constructor(private readonly published: ReadonlySet<string>) {}

  isPublished(contentId: string): Promise<boolean> {
    return Promise.resolve(this.published.has(contentId));
  }
}

function registration(
  overrides: Partial<RegisterAssetDto> = {},
): RegisterAssetDto {
  return {
    contentId: PUBLISHED_ID,
    objectKey1k: 'lidar/secret-key-1k.glb',
    objectKey2k: 'lidar/secret-key-2k.glb',
    posterKey: 'lidar/secret-key-poster.webp',
    usdzKey: 'lidar/secret-key.usdz',
    size1kBytes: 74_000,
    size2kBytes: 148_000,
    posterBytes: 12_000,
    status: 'ready',
    ...overrides,
  };
}

describe('AssetsService', () => {
  let repository: InMemoryAssetRepository;
  let service: AssetsService;

  beforeEach(() => {
    repository = new InMemoryAssetRepository();
    service = new AssetsService(
      repository,
      new FakeContentDirectory(new Set([PUBLISHED_ID])),
      config,
    );
  });

  it('returns delivery paths and sizes for a ready asset', async () => {
    const { id } = await service.register(registration());

    await expect(service.findDisplayByContentId(PUBLISHED_ID)).resolves.toEqual(
      {
        contentId: PUBLISHED_ID,
        status: 'ready',
        variants: {
          '1k': { url: `/api/lidar/files/${id}/1k`, bytes: 74_000 },
          '2k': { url: `/api/lidar/files/${id}/2k`, bytes: 148_000 },
        },
        poster: { url: `/api/lidar/files/${id}/poster` },
        ar: null,
      },
    );
  });

  it('never exposes object keys in the display metadata', async () => {
    await service.register(registration());

    const display = JSON.stringify(
      await service.findDisplayByContentId(PUBLISHED_ID),
    );

    expect(display).not.toContain('secret-key');
  });

  it('returns "none" when no asset exists', async () => {
    await expect(service.findDisplayByContentId(PUBLISHED_ID)).resolves.toEqual(
      {
        contentId: PUBLISHED_ID,
        status: 'none',
      },
    );
  });

  it('returns "none" while the asset is pending', async () => {
    await service.register(registration({ status: 'pending' }));

    await expect(service.findDisplayByContentId(PUBLISHED_ID)).resolves.toEqual(
      {
        contentId: PUBLISHED_ID,
        status: 'none',
      },
    );
  });

  it('rejects unknown or unpublished content without storing anything', async () => {
    await expect(
      service.register(registration({ contentId: UNPUBLISHED_ID })),
    ).rejects.toBeInstanceOf(ContentNotPublishedError);
    expect(repository.records.size).toBe(0);
  });

  it('returns only the identity and status of a registered asset', async () => {
    const registered = await service.register(registration());

    expect(registered).toEqual({
      id: 'asset-1',
      contentId: PUBLISHED_ID,
      status: 'ready',
    });
  });
});
