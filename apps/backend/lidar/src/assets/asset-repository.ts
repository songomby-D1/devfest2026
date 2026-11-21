import type { AssetRecord, NewAsset } from './asset.js';

export const ASSET_REPOSITORY = Symbol('ASSET_REPOSITORY');

export interface AssetRepository {
  findByContentId(contentId: string): Promise<AssetRecord | null>;
  /** @throws AssetAlreadyRegisteredError when the content already has an asset. */
  create(asset: NewAsset): Promise<AssetRecord>;
}
