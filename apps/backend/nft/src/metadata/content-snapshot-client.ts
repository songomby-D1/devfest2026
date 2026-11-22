import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { REQUEST_ID_HEADER } from '../common/public-error';
import {
  type ContentUnavailableReason,
  NFT_SERVICE_NAME,
  SERVICE_NAME_HEADER,
  SERVICE_TOKEN_HEADER,
} from '../content/content-client';

/**
 * The public part of Content's `ItemDetail` (`GET /internal/v1/items/{id}`,
 * docs/api/content.yaml) that NFT may publish. This schema is the first
 * allowlist: zod strips every other key (rights, reviews and reviewer IDs,
 * isOwner, advisory signals, timestamps, media URLs and captions), so they
 * never reach the metadata builder.
 */
const claimStatus = z.enum(['unreviewed', 'verified', 'uncertain']);
const nullableText = z.string().nullable();

export const itemSnapshotSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: z.string().min(1),
  publicationStatus: z.enum(['draft', 'published', 'unpublished']),
  description: z.string(),
  origin: nullableText,
  period: nullableText,
  creator: z.object({
    name: nullableText,
    community: nullableText,
    technique: nullableText,
  }),
  claims: z.object({ item: claimStatus, description: claimStatus }),
  media: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(['image', 'video']),
      mimeType: z.string().min(1),
      bytes: z.number().int().nonnegative(),
    }),
  ),
});

export type ItemSnapshot = z.infer<typeof itemSnapshotSchema>;
export type SnapshotMedia = ItemSnapshot['media'][number];

export type ItemSnapshotResult =
  | { readonly kind: 'found'; readonly item: ItemSnapshot }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'content_unavailable';
      readonly reason: ContentUnavailableReason;
    };

export interface MediaStream {
  /** Lowercase hex SHA-256 Content recorded, from its strong `ETag`. */
  readonly recordedSha256: string | null;
  readonly body: AsyncIterable<Uint8Array>;
  /** Releases the connection when the caller stops reading early. */
  cancel(): Promise<void>;
}

export type MediaStreamResult =
  | { readonly kind: 'found'; readonly media: MediaStream }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'content_unavailable';
      readonly reason: ContentUnavailableReason;
    };

export interface ContentSnapshotClientOptions {
  readonly baseUrl: string;
  /** NFT → Content secret. `undefined` or empty disables the calls. */
  readonly token: string | undefined;
  /** Budget of the item detail call. */
  readonly timeoutMs: number;
  /** Budget of a whole media download. */
  readonly mediaTimeoutMs: number;
}

/** Content documents the `ETag` as the quoted SHA-256 of the file. */
const SHA256_ETAG = /^"([0-9a-f]{64})"$/;

function errorName(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
    ? error.name
    : 'error';
}

function isTimeout(error: unknown): boolean {
  const name = errorName(error);
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * Reads a published item and its media from Content as the `nft` service,
 * without user headers. Content treats such a call as a guest, and a guest
 * reads published items and their media only (content.yaml `getItem`,
 * `getMedia`), which is exactly what NFT may publish.
 *
 * Sibling of `ContentClient` (NFT-02); it reuses its headers. No retry: the
 * caller already checked the publication with a retried lookup, and the
 * whole preparation is safe to run again.
 */
export class ContentSnapshotClient {
  private readonly logger = new Logger(ContentSnapshotClient.name);
  private readonly baseUrl: string;

  constructor(private readonly options: ContentSnapshotClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  async getItem(
    contentId: string,
    requestId: string,
  ): Promise<ItemSnapshotResult> {
    const path = `/internal/v1/items/${encodeURIComponent(contentId)}`;
    const response = await this.get(
      path,
      requestId,
      'application/json',
      this.options.timeoutMs,
    );
    if (response.kind !== 'ok') return response;

    let body: unknown;
    try {
      body = await response.response.json();
    } catch (error) {
      return this.unavailable(
        isTimeout(error) ? 'timeout' : 'invalid_response',
        'item detail',
        requestId,
      );
    }
    const parsed = itemSnapshotSchema.safeParse(body);
    if (
      !parsed.success ||
      parsed.data.id.toLowerCase() !== contentId.toLowerCase()
    ) {
      return this.unavailable('invalid_response', 'item detail', requestId);
    }
    return { kind: 'found', item: parsed.data };
  }

  async openMedia(
    contentId: string,
    mediaId: string,
    requestId: string,
  ): Promise<MediaStreamResult> {
    const path = `/internal/v1/items/${encodeURIComponent(contentId)}/media/${encodeURIComponent(mediaId)}`;
    const response = await this.get(
      path,
      requestId,
      '*/*',
      this.options.mediaTimeoutMs,
    );
    if (response.kind !== 'ok') return response;

    const body = response.response.body;
    if (body === null) {
      return this.unavailable('invalid_response', 'media', requestId);
    }
    const etag = SHA256_ETAG.exec(response.response.headers.get('etag') ?? '');
    return {
      kind: 'found',
      media: {
        recordedSha256: etag?.[1] ?? null,
        body,
        cancel: () => body.cancel().catch(() => undefined),
      },
    };
  }

  private async get(
    path: string,
    requestId: string,
    accept: string,
    timeoutMs: number,
  ): Promise<
    | { readonly kind: 'ok'; readonly response: Response }
    | Exclude<ItemSnapshotResult, { kind: 'found' }>
  > {
    const token = this.options.token;
    if (token === undefined || token === '') {
      return this.unavailable('not_configured', path, requestId);
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          accept,
          [SERVICE_NAME_HEADER]: NFT_SERVICE_NAME,
          [SERVICE_TOKEN_HEADER]: token,
          [REQUEST_ID_HEADER]: requestId,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return this.unavailable(
        isTimeout(error) ? 'timeout' : 'network',
        path,
        requestId,
      );
    }

    const { status } = response;
    if (status === 200) return { kind: 'ok', response };
    await response.body?.cancel().catch(() => undefined);
    if (status === 404) return { kind: 'not_found' };
    if (status === 401 || status === 403) {
      return this.unavailable('unauthenticated', path, requestId);
    }
    return this.unavailable(
      status >= 500 ? 'upstream_error' : 'rejected',
      `${path} (HTTP ${String(status)})`,
      requestId,
    );
  }

  private unavailable(
    reason: ContentUnavailableReason,
    what: string,
    requestId: string,
  ): {
    readonly kind: 'content_unavailable';
    reason: ContentUnavailableReason;
  } {
    this.logger.warn(
      `Content read failed for ${what}: ${reason} (request ${requestId})`,
    );
    return { kind: 'content_unavailable', reason };
  }
}
