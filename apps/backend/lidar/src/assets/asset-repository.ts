import type { AssetRecord, NewAsset } from './asset.js';

export const ASSET_REPOSITORY = Symbol('ASSET_REPOSITORY');

export interface AssetRepository {
  findByContentId(contentId: string): Promise<AssetRecord | null>;
  findById(id: string): Promise<AssetRecord | null>;
  /** Marks the asset ready; a no-op when it already is. */
  markReady(id: string): Promise<AssetRecord>;
  /** @throws AssetAlreadyRegisteredError when the content already has an asset. */
  create(asset: NewAsset): Promise<AssetRecord>;
}
