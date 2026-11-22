import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { REQUEST_ID_HEADER } from '../common/public-error';

/** Headers of the platform contract for service-to-service calls. */
export const SERVICE_NAME_HEADER = 'x-service-name';
export const SERVICE_TOKEN_HEADER = 'x-service-token';
export const NFT_SERVICE_NAME = 'nft';
export const CALLER_USER_ID_HEADER = 'x-caller-user-id';
export const CALLER_PERMISSIONS_HEADER = 'x-caller-permissions';

/**
 * `GET /internal/v1/items/{id}/publication` answer (docs/api/content.yaml,
 * `PublicationLookup`). Validated locally (D14). Unknown keys are stripped so
 * that an additive change on the Content side does not break NFT.
 */
const publicationLookupSchema = z.object({
  contentId: z.uuid(),
  publicationStatus: z.enum(['draft', 'published', 'unpublished']),
});

export type UnpublishedStatus = 'draft' | 'unpublished';

/** Why Content could not answer. Logged, never returned to users. */
export type ContentUnavailableReason =
  | 'not_configured'
  | 'timeout'
  | 'network'
  | 'unauthenticated'
  | 'rejected'
  | 'upstream_error'
  | 'invalid_response';

/** Outcome of a publication lookup, independent of HTTP. */
export type PublicationLookupResult =
  | { readonly kind: 'published'; readonly contentId: string }
  | {
      readonly kind: 'not_published';
      readonly contentId: string;
      readonly publicationStatus: UnpublishedStatus;
    }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'content_unavailable';
      readonly reason: ContentUnavailableReason;
    };

export interface ContentClientOptions {
  readonly baseUrl: string;
  /** NFT → Content secret. `undefined` or empty disables the call. */
  readonly token: string | undefined;
  readonly timeoutMs: number;
  /** Extra attempts after a connection failure or a 502, 503 or 504. */
  readonly retries?: number;
  readonly retryDelayMs?: number;
}

const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 100;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * `GET /internal/v1/items/{id}` answer, reduced to what the ownership check
 * needs (docs/api/content.yaml, `ItemDetail`). Content computes `isOwner`
 * from the caller headers NFT relays (platform contract).
 */
const itemOwnershipSchema = z.object({
  id: z.uuid(),
  isOwner: z.boolean(),
});

/** Caller headers relayed unchanged to Content for a user's request. */
export interface RelayedCaller {
  readonly userId: string;
  readonly permissions: readonly string[];
}

/** Outcome of an ownership check (S1), independent of HTTP. */
export type ItemOwnershipResult =
  | { readonly kind: 'owner' }
  | { readonly kind: 'not_owner' }
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'content_unavailable';
      readonly reason: ContentUnavailableReason;
    };

type Attempt<T> =
  | { readonly done: true; readonly result: T }
  | { readonly done: false; readonly reason: ContentUnavailableReason };

/** One GET on Content, mapped to a domain result. */
interface Lookup<T> {
  /** Used in log lines, e.g. "publication lookup". */
  readonly label: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly parse: (body: unknown) => T | undefined;
  readonly notFound: T;
  readonly unavailable: (reason: ContentUnavailableReason) => T;
}

function unavailable(
  reason: ContentUnavailableReason,
): PublicationLookupResult {
  return { kind: 'content_unavailable', reason };
}

/** Name of an error from any realm: `DOMException` may not be an `Error` here. */
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Typed client for Content's publication lookup (NFT-02, D01, D16) and
 * ownership lookup (NFT-04, S1).
 *
 * - Synchronous HTTP with a timeout per attempt.
 * - No retry on a 4xx or a timeout. One short retry on a connection failure
 *   or a 502, 503 or 504, which are transient on a restarting container; the
 *   lookup is a read, so a retry is safe, and the worst case stays close to
 *   one timeout.
 * - The secret is sent in `x-service-token` and never logged.
 */
export class ContentClient {
  private readonly logger = new Logger(ContentClient.name);
  private readonly baseUrl: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: ContentClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  /** `contentId` must already be a UUID; the caller validates it. */
  getPublication(
    contentId: string,
    requestId: string,
  ): Promise<PublicationLookupResult> {
    return this.lookup<PublicationLookupResult>(requestId, {
      label: 'publication lookup',
      path: `/internal/v1/items/${encodeURIComponent(contentId)}/publication`,
      headers: {},
      parse: (body) => {
        const parsed = publicationLookupSchema.safeParse(body);
        if (
          !parsed.success ||
          parsed.data.contentId.toLowerCase() !== contentId.toLowerCase()
        ) {
          return undefined;
        }
        const { publicationStatus } = parsed.data;
        return publicationStatus === 'published'
          ? { kind: 'published', contentId: parsed.data.contentId }
          : {
              kind: 'not_published',
              contentId: parsed.data.contentId,
              publicationStatus,
            };
      },
      notFound: { kind: 'not_found' },
      unavailable,
    });
  }

  /**
   * Asks Content whether the caller owns the item (S1, NFT-04), by reading
   * the item detail with the caller headers relayed unchanged. Content is the
   * only owner of `ownerId`; NFT never stores or compares it.
   */
  getItemOwnership(
    contentId: string,
    caller: RelayedCaller,
    requestId: string,
  ): Promise<ItemOwnershipResult> {
    return this.lookup<ItemOwnershipResult>(requestId, {
      label: 'ownership lookup',
      path: `/internal/v1/items/${encodeURIComponent(contentId)}`,
      headers: {
        [CALLER_USER_ID_HEADER]: caller.userId,
        [CALLER_PERMISSIONS_HEADER]: caller.permissions.join(','),
      },
      parse: (body) => {
        const parsed = itemOwnershipSchema.safeParse(body);
        if (
          !parsed.success ||
          parsed.data.id.toLowerCase() !== contentId.toLowerCase()
        ) {
          return undefined;
        }
        return parsed.data.isOwner ? { kind: 'owner' } : { kind: 'not_owner' };
      },
      notFound: { kind: 'not_found' },
      unavailable: (reason) => ({ kind: 'content_unavailable', reason }),
    });
  }

  private async lookup<T>(requestId: string, spec: Lookup<T>): Promise<T> {
    const token = this.options.token;
    if (token === undefined || token === '') {
      this.logger.error(
        `Content ${spec.label} skipped: CONTENT_SERVICE_TOKEN is not set (request ${requestId})`,
      );
      return spec.unavailable('not_configured');
    }

    let reason: ContentUnavailableReason = 'network';
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) await delay(this.retryDelayMs * attempt);
      const outcome = await this.attempt(spec, requestId, token);
      if (outcome.done) return outcome.result;
      reason = outcome.reason;
    }
    this.logger.warn(
      `Content ${spec.label} failed after ${String(this.retries + 1)} attempt(s): ${reason} (request ${requestId})`,
    );
    return spec.unavailable(reason);
  }

  private async attempt<T>(
    spec: Lookup<T>,
    requestId: string,
    token: string,
  ): Promise<Attempt<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${spec.path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...spec.headers,
          [SERVICE_NAME_HEADER]: NFT_SERVICE_NAME,
          [SERVICE_TOKEN_HEADER]: token,
          [REQUEST_ID_HEADER]: requestId,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) {
        this.logger.warn(
          `Content ${spec.label} timed out after ${String(this.options.timeoutMs)} ms (request ${requestId})`,
        );
        return { done: true, result: spec.unavailable('timeout') };
      }
      this.logger.warn(
        `Content ${spec.label} could not reach Content: ${errorName(error)} (request ${requestId})`,
      );
      return { done: false, reason: 'network' };
    }

    return this.interpret(response, spec, requestId);
  }

  private async interpret<T>(
    response: Response,
    spec: Lookup<T>,
    requestId: string,
  ): Promise<Attempt<T>> {
    const { status } = response;
    if (status === 200) {
      return {
        done: true,
        result: await this.parse(response, spec, requestId),
      };
    }
    // The body is not needed: release the connection.
    await response.body?.cancel().catch(() => undefined);

    if (status === 404) return { done: true, result: spec.notFound };
    if (status === 401 || status === 403) {
      this.logger.error(
        `Content refused the NFT service credentials (HTTP ${String(status)}): ` +
          `check that CONTENT_SERVICE_TOKEN matches Content's CONTENT_INBOUND_TOKEN_NFT (request ${requestId})`,
      );
      return { done: true, result: spec.unavailable('unauthenticated') };
    }
    if (status >= 400 && status < 500) {
      this.logger.error(
        `Content rejected the ${spec.label} (HTTP ${String(status)}) (request ${requestId})`,
      );
      return { done: true, result: spec.unavailable('rejected') };
    }
    this.logger.warn(
      `Content answered HTTP ${String(status)} to the ${spec.label} (request ${requestId})`,
    );
    return RETRYABLE_STATUSES.has(status)
      ? { done: false, reason: 'upstream_error' }
      : { done: true, result: spec.unavailable('upstream_error') };
  }

  private async parse<T>(
    response: Response,
    spec: Lookup<T>,
    requestId: string,
  ): Promise<T> {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isTimeout(error)) {
        this.logger.warn(
          `Content ${spec.label} timed out while reading the body (request ${requestId})`,
        );
        return spec.unavailable('timeout');
      }
      body = undefined;
    }
    const result = spec.parse(body);
    if (result === undefined) {
      this.logger.error(
        `Content answered an invalid ${spec.label} body (request ${requestId})`,
      );
      return spec.unavailable('invalid_response');
    }
    return result;
  }
}
