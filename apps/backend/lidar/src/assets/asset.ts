export type AssetStatus = 'pending' | 'ready';

export interface AssetRecord {
  readonly id: string;
  readonly contentId: string;
  readonly objectKey1k: string;
  readonly objectKey2k: string;
  readonly posterKey: string;
  readonly usdzKey: string | null;
  readonly size1kBytes: number;
  readonly size2kBytes: number;
  readonly posterBytes: number;
  readonly status: AssetStatus;
}

export type NewAsset = Omit<AssetRecord, 'id'>;

export interface DeliveryVariant {
  readonly url: string;
  readonly bytes: number;
}

export interface ReadyAssetDisplay {
  readonly contentId: string;
  readonly status: 'ready';
  readonly variants: {
    readonly '1k': DeliveryVariant;
    readonly '2k': DeliveryVariant;
  };
  readonly poster: { readonly url: string };
  readonly ar: null;
}

export interface NoAssetDisplay {
  readonly contentId: string;
  readonly status: 'none';
}

export type AssetDisplay = ReadyAssetDisplay | NoAssetDisplay;

export interface RegisteredAsset {
  readonly id: string;
  readonly contentId: string;
  readonly status: AssetStatus;
}

export class ContentNotPublishedError extends Error {
  constructor() {
    super('Content is unknown or not published');
    this.name = 'ContentNotPublishedError';
  }
}

export class AssetAlreadyRegisteredError extends Error {
  constructor() {
    super('An asset is already registered for this content');
    this.name = 'AssetAlreadyRegisteredError';
  }
}
