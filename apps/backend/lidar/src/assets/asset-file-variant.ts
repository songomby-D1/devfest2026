import type { AssetRecord } from './asset.js';

export const ASSET_FILE_VARIANTS = ['1k', '2k', 'poster', 'usdz'] as const;
export type AssetFileVariant = (typeof ASSET_FILE_VARIANTS)[number];

/** Files that must be stored before an asset can become ready. */
export const REQUIRED_VARIANTS: readonly AssetFileVariant[] = [
  '1k',
  '2k',
  'poster',
];

export type FileSignature = 'glb' | 'webp' | 'zip';

// The USDZ size is not recorded by 3D-04b, so its upload has a fixed ceiling instead.
const MAX_USDZ_BYTES = 64 * 1024 * 1024;

export interface VariantSpec {
  readonly contentType: string;
  readonly signature: FileSignature;
  readonly objectKey: (asset: AssetRecord) => string | null;
  /** Exact registered size, or null when only a ceiling applies. */
  readonly registeredBytes: (asset: AssetRecord) => number | null;
  readonly maxBytes: number | null;
}

export const VARIANT_SPECS: Readonly<Record<AssetFileVariant, VariantSpec>> = {
  '1k': {
    contentType: 'model/gltf-binary',
    signature: 'glb',
    objectKey: (asset) => asset.objectKey1k,
    registeredBytes: (asset) => asset.size1kBytes,
    maxBytes: null,
  },
  '2k': {
    contentType: 'model/gltf-binary',
    signature: 'glb',
    objectKey: (asset) => asset.objectKey2k,
    registeredBytes: (asset) => asset.size2kBytes,
    maxBytes: null,
  },
  poster: {
    contentType: 'image/webp',
    signature: 'webp',
    objectKey: (asset) => asset.posterKey,
    registeredBytes: (asset) => asset.posterBytes,
    maxBytes: null,
  },
  usdz: {
    contentType: 'model/vnd.usdz+zip',
    signature: 'zip',
    objectKey: (asset) => asset.usdzKey,
    registeredBytes: () => null,
    maxBytes: MAX_USDZ_BYTES,
  },
};

export function isAssetFileVariant(value: string): value is AssetFileVariant {
  return (ASSET_FILE_VARIANTS as readonly string[]).includes(value);
}
