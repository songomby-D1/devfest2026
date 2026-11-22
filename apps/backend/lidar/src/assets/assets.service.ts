import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import {
  type AssetDisplay,
  type AssetRecord,
  ContentNotPublishedError,
  type RegisteredAsset,
} from './asset.js';
import { ASSET_REPOSITORY, type AssetRepository } from './asset-repository.js';
import {
  CONTENT_DIRECTORY,
  type ContentDirectory,
} from './content-directory.js';
import type { RegisterAssetDto } from './register-asset.dto.js';

@Injectable()
export class AssetsService {
  private readonly deliveryBasePath: string;

  constructor(
    @Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository,
    @Inject(CONTENT_DIRECTORY)
    private readonly contentDirectory: ContentDirectory,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.deliveryBasePath = config.publicAssetBasePath;
  }

  async findDisplayByContentId(contentId: string): Promise<AssetDisplay> {
    const asset = await this.assets.findByContentId(contentId);
    if (asset?.status !== 'ready') return { contentId, status: 'none' };
    return this.toReadyDisplay(asset);
  }

  async register(input: RegisterAssetDto): Promise<RegisteredAsset> {
    if (!(await this.contentDirectory.isPublished(input.contentId))) {
      throw new ContentNotPublishedError();
    }
    const asset = await this.assets.create(input);
    return { id: asset.id, contentId: asset.contentId, status: asset.status };
  }

  private toReadyDisplay(asset: AssetRecord): AssetDisplay {
    const deliveryUrl = (file: string): string =>
      `${this.deliveryBasePath}/${asset.id}/${file}`;
    return {
      contentId: asset.contentId,
      status: 'ready',
      variants: {
        '1k': { url: deliveryUrl('1k'), bytes: asset.size1kBytes },
        '2k': { url: deliveryUrl('2k'), bytes: asset.size2kBytes },
      },
      poster: { url: deliveryUrl('poster') },
      ar: null,
    };
  }
}
