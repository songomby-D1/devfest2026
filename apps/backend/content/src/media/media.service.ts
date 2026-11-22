import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { CallerContext } from '../common/caller-context';
import { PublicError } from '../common/public-error';
import { parseOrThrow } from '../common/zod-validation';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { ItemRecord, MediaChange, MediaRecord } from '../items/item';
import { ITEM_REPOSITORY, type ItemRepository } from '../items/item-repository';
import { type MediaRefView, toMediaRef } from '../items/item-view';
import { ITEM_PUBLISHED, canView } from '../items/items.service';
import { rejectedConflict } from '../items/review';
import {
  OBJECT_STORAGE,
  ObjectNotFoundError,
  type ObjectRange,
  type ObjectStorage,
  StorageUnavailableError,
} from '../storage/object-storage';
import { parseByteRange } from './byte-range';
import {
  type MediaType,
  isMediaType,
  kindOf,
  matchesSignature,
  normalizeType,
} from './media-format';
import {
  type SpooledFile,
  type UploadSource,
  payloadTooLarge,
  receiveUpload,
} from './multipart-upload';

export const MEDIA_LIMIT_REACHED = 'MEDIA_LIMIT_REACHED';
export const RANGE_NOT_SATISFIABLE = 'RANGE_NOT_SATISFIABLE';

/**
 * Bytes behind a media ID never change, so a published file is immutable.
 * The short lifetime bounds how long a shared cache could keep serving a
 * file after its item is unpublished (D05: authorize on current visibility).
 */
export const PUBLISHED_CACHE_CONTROL = 'public, max-age=3600, immutable';
/** Drafts and unpublished items are private to their owner and reviewers. */
export const PRIVATE_CACHE_CONTROL = 'private, no-store';

const captionSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(300, 'must be at most 300 characters')
    .transform((value) => (value === '' ? null : value))
    .optional(),
});

export type MediaDelivery =
  | {
      readonly kind: 'content';
      readonly status:
        HttpStatus.OK | HttpStatus.PARTIAL_CONTENT | HttpStatus.NOT_MODIFIED;
      readonly headers: Readonly<Record<string, string>>;
      /** Null for a HEAD request or a 304. */
      readonly body: Readable | null;
    }
  | {
      readonly kind: 'unsatisfiable';
      readonly size: number;
      readonly cacheControl: string;
    };

export interface DeliveryRequest {
  readonly range: string | undefined;
  readonly ifRange: string | undefined;
  readonly ifNoneMatch: string | undefined;
  readonly headOnly: boolean;
}

function mediaNotFound(): PublicError {
  return new PublicError(
    'NOT_FOUND',
    'The media does not exist',
    HttpStatus.NOT_FOUND,
  );
}

function storageUnavailable(): PublicError {
  return new PublicError(
    'STORAGE_UNAVAILABLE',
    'Media storage is temporarily unavailable',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

function unsupportedType(message: string): PublicError {
  return new PublicError(
    'UNSUPPORTED_MEDIA_TYPE',
    message,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  );
}

function requireUser(caller: CallerContext): string {
  if (caller.userId === null) throw PublicError.unauthenticated();
  return caller.userId;
}

/**
 * Media changes follow the item edit rules: only the owner, only while the
 * item is not published (D13) and never on a rejected submission
 * (CONTENT-04). Others get 404 for an item they cannot see and 403 otherwise.
 */
export function assertMediaEditable(
  item: ItemRecord,
  caller: CallerContext,
): void {
  if (!canView(item, caller)) throw PublicError.notFound();
  if (item.ownerId !== caller.userId) {
    throw PublicError.forbidden('Only the submitter can change its media');
  }
  if (item.publicationStatus === 'published') {
    throw new PublicError(
      ITEM_PUBLISHED,
      'The media of a published item cannot be changed',
      HttpStatus.CONFLICT,
    );
  }
  if (item.submissionStatus === 'rejected') throw rejectedConflict();
}

async function withStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Gate 0 `uploadMedia`: appends one image or video to an owned item. */
  async upload(
    caller: CallerContext,
    itemId: string,
    source: UploadSource,
  ): Promise<MediaRefView> {
    requireUser(caller);
    // Checked before reading the body, then again under the item lock.
    const item = await this.editableItem(caller, itemId);
    this.assertRoom(item);
    return this.store(caller, itemId, source, null);
  }

  /** Replaces one media at the same position with a new ID and object. */
  async replace(
    caller: CallerContext,
    itemId: string,
    mediaId: string,
    source: UploadSource,
  ): Promise<MediaRefView> {
    requireUser(caller);
    const item = await this.editableItem(caller, itemId);
    if (!item.media.some((media) => media.id === mediaId)) {
      throw mediaNotFound();
    }
    return this.store(caller, itemId, source, mediaId);
  }

  async remove(
    caller: CallerContext,
    itemId: string,
    mediaId: string,
  ): Promise<void> {
    requireUser(caller);
    const result = await this.items.changeMedia(itemId, (current) => {
      assertMediaEditable(current, caller);
      if (!current.media.some((media) => media.id === mediaId)) {
        throw mediaNotFound();
      }
      return { removeId: mediaId };
    });
    if (result === null) throw PublicError.notFound();
    if (result.removed !== null) await this.discard(result.removed);
  }

  /**
   * Gate 0 `getMedia`. A published item's media is public; otherwise only
   * the owner and reviewers can read it, and everyone else gets 404.
   */
  async deliver(
    caller: CallerContext,
    itemId: string,
    mediaId: string,
    request: DeliveryRequest,
  ): Promise<MediaDelivery> {
    const item = await this.items.findById(itemId);
    if (item === null || !canView(item, caller)) throw mediaNotFound();
    const media = item.media.find((candidate) => candidate.id === mediaId);
    if (media === undefined) throw mediaNotFound();

    const etag = `"${media.sha256}"`;
    const cacheControl =
      item.publicationStatus === 'published'
        ? PUBLISHED_CACHE_CONTROL
        : PRIVATE_CACHE_CONTROL;
    const headers: Record<string, string> = {
      'content-type': media.contentType,
      'accept-ranges': 'bytes',
      etag,
      'cache-control': cacheControl,
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    };

    if (
      request.ifNoneMatch !== undefined &&
      matchesEtag(request.ifNoneMatch, etag)
    ) {
      return {
        kind: 'content',
        status: HttpStatus.NOT_MODIFIED,
        headers,
        body: null,
      };
    }

    // A stale If-Range validator asks for the whole file (RFC 9110, 13.1.5).
    const rangeHeader =
      request.ifRange === undefined || request.ifRange === etag
        ? request.range
        : undefined;
    const range = parseByteRange(rangeHeader, media.bytes);
    if (range.kind === 'unsatisfiable') {
      return { kind: 'unsatisfiable', size: media.bytes, cacheControl };
    }
    const partial = range.kind === 'partial' ? range : null;
    if (partial !== null) {
      headers['content-range'] =
        `bytes ${String(partial.start)}-${String(partial.end)}/${String(media.bytes)}`;
      headers['content-length'] = String(partial.end - partial.start + 1);
    } else {
      headers['content-length'] = String(media.bytes);
    }

    const body = request.headOnly
      ? null
      : await this.read(media.storageKey, partial ?? undefined);
    return {
      kind: 'content',
      status: partial === null ? HttpStatus.OK : HttpStatus.PARTIAL_CONTENT,
      headers,
      body,
    };
  }

  private async editableItem(
    caller: CallerContext,
    itemId: string,
  ): Promise<ItemRecord> {
    const item = await this.items.findById(itemId);
    if (item === null) throw PublicError.notFound();
    assertMediaEditable(item, caller);
    return item;
  }

  private assertRoom(item: ItemRecord): void {
    if (item.media.length >= this.config.media.maxPerItem) {
      throw new PublicError(
        MEDIA_LIMIT_REACHED,
        `An item holds at most ${String(this.config.media.maxPerItem)} media files`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Receives the file, checks it, writes it under a fresh key and records it.
   * The record is written last, under the item lock; if that fails, the new
   * object is deleted again. A replaced object is deleted after the commit.
   */
  private async store(
    caller: CallerContext,
    itemId: string,
    source: UploadSource,
    replaceId: string | null,
  ): Promise<MediaRefView> {
    const { maxImageBytes, maxVideoBytes } = this.config.media;
    const upload = await receiveUpload(
      source,
      Math.max(maxImageBytes, maxVideoBytes),
    );
    try {
      const contentType = this.checkFile(upload.file);
      const { caption } = parseOrThrow(captionSchema, {
        caption: upload.caption,
      });
      const id = randomUUID();
      // Generated key: the client filename is never used.
      const storageKey = `items/${itemId}/${id}`;
      await withStorage(() =>
        this.storage.write(storageKey, createReadStream(upload.file.path), {
          contentType,
          contentLength: upload.file.bytes,
        }),
      );

      const decide = (current: ItemRecord): MediaChange => {
        assertMediaEditable(current, caller);
        const replaced = current.media.find((media) => media.id === replaceId);
        if (replaceId !== null && replaced === undefined) throw mediaNotFound();
        if (replaceId === null) this.assertRoom(current);
        return {
          add: {
            id,
            kind: kindOf(contentType),
            contentType,
            bytes: upload.file.bytes,
            sha256: upload.file.sha256,
            storageKey,
            // A replacement keeps the caption unless a new one is sent.
            caption:
              caption === undefined ? (replaced?.caption ?? null) : caption,
          },
          ...(replaceId === null ? {} : { removeId: replaceId }),
        };
      };

      let result;
      try {
        result = await this.items.changeMedia(itemId, decide);
      } catch (error) {
        await this.discardKey(storageKey, id);
        throw error;
      }
      if (result === null || result.added === null) {
        await this.discardKey(storageKey, id);
        throw PublicError.notFound();
      }
      if (result.removed !== null) await this.discard(result.removed);
      return toMediaRef(itemId, result.added);
    } finally {
      await upload.dispose();
    }
  }

  /** The declared type must be allowlisted and match the file signature. */
  private checkFile(file: SpooledFile): MediaType {
    const declared = normalizeType(file.declaredType);
    if (!isMediaType(declared)) {
      throw unsupportedType(
        'Upload a JPEG, PNG or WebP image, or an MP4 or WebM video',
      );
    }
    if (!matchesSignature(declared, file.head)) {
      throw unsupportedType('The file content does not match its type');
    }
    const max =
      kindOf(declared) === 'image'
        ? this.config.media.maxImageBytes
        : this.config.media.maxVideoBytes;
    if (file.bytes > max) throw payloadTooLarge(max);
    return declared;
  }

  private async read(
    key: string,
    range: ObjectRange | undefined,
  ): Promise<Readable> {
    try {
      return await withStorage(() => this.storage.read(key, range));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) throw mediaNotFound();
      throw error;
    }
  }

  private discard(media: MediaRecord): Promise<void> {
    return this.discardKey(media.storageKey, media.id);
  }

  /** Best effort: a failure leaves an orphaned object, which is logged. */
  private async discardKey(key: string, mediaId: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `Orphaned object of media ${mediaId}: ${error instanceof Error ? error.name : 'error'}`,
      );
    }
  }
}

/** Weak comparison of an If-None-Match list against a strong ETag. */
function matchesEtag(header: string, etag: string): boolean {
  if (header.trim() === '*') return true;
  return header
    .split(',')
    .map((value) => value.trim().replace(/^W\//, ''))
    .includes(etag);
}
