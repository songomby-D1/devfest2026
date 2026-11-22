import type { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PublicError } from '../common/public-error.js';
import {
  OBJECT_STORAGE,
  ObjectNotFoundError,
  type ObjectRange,
  type ObjectStorage,
  StorageUnavailableError,
} from '../storage/object-storage.js';
import type { AssetRecord, AssetStatus } from './asset.js';
import {
  type AssetFileVariant,
  isAssetFileVariant,
  REQUIRED_VARIANTS,
  VARIANT_SPECS,
} from './asset-file-variant.js';
import { ASSET_REPOSITORY, type AssetRepository } from './asset-repository.js';
import { parseByteRange } from './byte-range.js';
import {
  CONTENT_DIRECTORY,
  type ContentDirectory,
  ContentDirectoryUnavailableError,
} from './content-directory.js';
import { FileValidationStream, InvalidFileError } from './file-signature.js';

// Object keys are per asset and never overwritten once served, so files never change.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const GENERIC_UPLOAD_TYPE = 'application/octet-stream';
const assetIdSchema = z.uuid();

export type FileDelivery =
  | {
      readonly kind: 'content';
      readonly status: HttpStatus.OK | HttpStatus.PARTIAL_CONTENT;
      readonly headers: Readonly<Record<string, string>>;
      /** Null for a HEAD request. */
      readonly body: Readable | null;
    }
  | { readonly kind: 'unsatisfiable'; readonly size: number };

export interface UploadRequest {
  readonly contentType: string | undefined;
  readonly contentLength: string | undefined;
  readonly body: Readable;
}

export interface StoredFile {
  readonly assetId: string;
  readonly variant: AssetFileVariant;
  readonly bytes: number;
  readonly assetStatus: AssetStatus;
}

// One code for unknown assets, unpublished content and missing objects, so
// clients cannot probe which items exist; the frontend shows its fallback.
const fileNotFound = (): PublicError =>
  new PublicError(
    'MODEL3D_FILE_NOT_FOUND',
    '3D file not found',
    HttpStatus.NOT_FOUND,
  );

@Injectable()
export class AssetFilesService {
  constructor(
    @Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository,
    @Inject(CONTENT_DIRECTORY)
    private readonly contentDirectory: ContentDirectory,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async deliver(
    assetId: string,
    variantName: string,
    rangeHeader: string | undefined,
    headOnly: boolean,
  ): Promise<FileDelivery> {
    if (!isAssetFileVariant(variantName)) throw fileNotFound();
    const asset = await this.findAsset(assetId);
    if (asset?.status !== 'ready') throw fileNotFound();
    const spec = VARIANT_SPECS[variantName];
    const key = spec.objectKey(asset);
    if (key === null) throw fileNotFound();
    if (!(await this.isPublished(asset.contentId))) throw fileNotFound();

    const object = await withStorage(() => this.storage.stat(key));
    if (object === null) throw fileNotFound();

    const range = parseByteRange(rangeHeader, object.size);
    if (range.kind === 'unsatisfiable')
      return { kind: 'unsatisfiable', size: object.size };

    const headers: Record<string, string> = {
      'content-type': spec.contentType,
      'accept-ranges': 'bytes',
      'cache-control': IMMUTABLE_CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    };
    if (object.etag) headers.etag = object.etag;

    const partial = range.kind === 'partial' ? range : null;
    if (partial) {
      headers['content-range'] =
        `bytes ${String(partial.start)}-${String(partial.end)}/${String(object.size)}`;
      headers['content-length'] = String(partial.end - partial.start + 1);
    } else {
      headers['content-length'] = String(object.size);
    }

    const body = headOnly ? null : await this.read(key, partial ?? undefined);
    return {
      kind: 'content',
      status: partial ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK,
      headers,
      body,
    };
  }

  async upload(
    assetId: string,
    variantName: string,
    request: UploadRequest,
  ): Promise<StoredFile> {
    if (!isAssetFileVariant(variantName)) {
      throw new PublicError(
        'VARIANT_UNKNOWN',
        'Unknown file variant',
        HttpStatus.NOT_FOUND,
      );
    }
    const asset = await this.findAsset(assetId);
    if (asset === null) {
      throw new PublicError(
        'ASSET_NOT_FOUND',
        'Asset not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const spec = VARIANT_SPECS[variantName];
    const key = spec.objectKey(asset);
    if (key === null) {
      throw new PublicError(
        'USDZ_NOT_REGISTERED',
        'The asset was registered without a USDZ key',
        HttpStatus.CONFLICT,
      );
    }

    const mediaType = request.contentType?.split(';')[0]?.trim().toLowerCase();
    if (mediaType !== spec.contentType && mediaType !== GENERIC_UPLOAD_TYPE) {
      throw new PublicError(
        'UNSUPPORTED_MEDIA_TYPE',
        `Expected ${spec.contentType} or ${GENERIC_UPLOAD_TYPE}`,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    const bytes = parseContentLength(request.contentLength);
    checkSize(bytes, spec.registeredBytes(asset), spec.maxBytes);

    if (
      asset.status === 'ready' &&
      (await withStorage(() => this.storage.stat(key)))
    ) {
      throw new PublicError(
        'FILE_ALREADY_STORED',
        'Files of a ready asset are immutable',
        HttpStatus.CONFLICT,
      );
    }

    const validated = request.body.pipe(
      new FileValidationStream(spec.signature, bytes),
    );
    request.body.once('error', (error) => validated.destroy(error));
    try {
      await this.storage.write(key, validated, {
        contentType: spec.contentType,
        contentLength: bytes,
      });
    } catch (error) {
      if (error instanceof InvalidFileError) {
        throw new PublicError(
          'INVALID_FILE',
          error.message,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      throw toStorageFailure(error);
    }

    const status = await this.refreshStatus(asset);
    return {
      assetId: asset.id,
      variant: variantName,
      bytes,
      assetStatus: status,
    };
  }

  private async read(
    key: string,
    range: ObjectRange | undefined,
  ): Promise<Readable> {
    try {
      return await withStorage(() => this.storage.read(key, range));
    } catch (error) {
      // The object can disappear between stat and read.
      if (error instanceof ObjectNotFoundError) throw fileNotFound();
      throw error;
    }
  }

  private async findAsset(assetId: string): Promise<AssetRecord | null> {
    if (!assetIdSchema.safeParse(assetId).success) return null;
    return this.assets.findById(assetId);
  }

  private async isPublished(contentId: string): Promise<boolean> {
    try {
      return await this.contentDirectory.isPublished(contentId);
    } catch (error) {
      if (error instanceof ContentDirectoryUnavailableError) {
        throw new PublicError(
          'CONTENT_UNAVAILABLE',
          'Publication status is temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  /** A pending asset becomes ready once its GLB 1K, GLB 2K and poster are stored. */
  private async refreshStatus(asset: AssetRecord): Promise<AssetStatus> {
    if (asset.status === 'ready') return 'ready';
    for (const variant of REQUIRED_VARIANTS) {
      const key = VARIANT_SPECS[variant].objectKey(asset);
      if (
        key === null ||
        (await withStorage(() => this.storage.stat(key))) === null
      ) {
        return asset.status;
      }
    }
    return (await this.assets.markReady(asset.id)).status;
  }
}

function parseContentLength(header: string | undefined): number {
  const bytes =
    header !== undefined && /^\d+$/.test(header) ? Number(header) : NaN;
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new PublicError(
      'LENGTH_REQUIRED',
      'A positive Content-Length is required',
      HttpStatus.LENGTH_REQUIRED,
    );
  }
  return bytes;
}

function checkSize(
  bytes: number,
  registered: number | null,
  max: number | null,
): void {
  if (registered !== null && bytes !== registered) {
    throw new PublicError(
      'SIZE_MISMATCH',
      'Content-Length differs from the registered size',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (max !== null && bytes > max) {
    throw new PublicError(
      'FILE_TOO_LARGE',
      'File exceeds the size limit',
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

async function withStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toStorageFailure(error);
  }
}

function toStorageFailure(error: unknown): unknown {
  if (error instanceof StorageUnavailableError) {
    return new PublicError(
      'STORAGE_UNAVAILABLE',
      'Object storage is temporarily unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  return error;
}
