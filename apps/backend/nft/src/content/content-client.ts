import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { REQUEST_ID_HEADER } from '../common/public-error';

/** Headers of the platform contract for service-to-service calls. */
export const SERVICE_NAME_HEADER = 'x-service-name';
export const SERVICE_TOKEN_HEADER = 'x-service-token';
export const NFT_SERVICE_NAME = 'nft';

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

type Attempt =
  | { readonly done: true; readonly result: PublicationLookupResult }
  | { readonly done: false; readonly reason: ContentUnavailableReason };

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
 * Typed client for Content's publication lookup (NFT-02, D01, D16).
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
  async getPublication(
    contentId: string,
    requestId: string,
  ): Promise<PublicationLookupResult> {
    const token = this.options.token;
    if (token === undefined || token === '') {
      this.logger.error(
        `Content lookup skipped: CONTENT_SERVICE_TOKEN is not set (request ${requestId})`,
      );
      return unavailable('not_configured');
    }

    let reason: ContentUnavailableReason = 'network';
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) await delay(this.retryDelayMs * attempt);
      const outcome = await this.attempt(contentId, requestId, token);
      if (outcome.done) return outcome.result;
      reason = outcome.reason;
    }
    this.logger.warn(
      `Content lookup failed after ${String(this.retries + 1)} attempt(s): ${reason} (request ${requestId})`,
    );
    return unavailable(reason);
  }

  private async attempt(
    contentId: string,
    requestId: string,
    token: string,
  ): Promise<Attempt> {
    const url = `${this.baseUrl}/internal/v1/items/${encodeURIComponent(contentId)}/publication`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
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
          `Content lookup timed out after ${String(this.options.timeoutMs)} ms (request ${requestId})`,
        );
        return { done: true, result: unavailable('timeout') };
      }
      this.logger.warn(
        `Content lookup could not reach Content: ${errorName(error)} (request ${requestId})`,
      );
      return { done: false, reason: 'network' };
    }

    return this.interpret(response, contentId, requestId);
  }

  private async interpret(
    response: Response,
    contentId: string,
    requestId: string,
  ): Promise<Attempt> {
    const { status } = response;
    if (status === 200) {
      return {
        done: true,
        result: await this.parse(response, contentId, requestId),
      };
    }
    // The body is not needed: release the connection.
    await response.body?.cancel().catch(() => undefined);

    if (status === 404) return { done: true, result: { kind: 'not_found' } };
    if (status === 401 || status === 403) {
      this.logger.error(
        `Content refused the NFT service credentials (HTTP ${String(status)}): ` +
          `check that CONTENT_SERVICE_TOKEN matches Content's CONTENT_INBOUND_TOKEN_NFT (request ${requestId})`,
      );
      return { done: true, result: unavailable('unauthenticated') };
    }
    if (status >= 400 && status < 500) {
      this.logger.error(
        `Content rejected the publication lookup (HTTP ${String(status)}) (request ${requestId})`,
      );
      return { done: true, result: unavailable('rejected') };
    }
    this.logger.warn(
      `Content answered HTTP ${String(status)} to the publication lookup (request ${requestId})`,
    );
    return RETRYABLE_STATUSES.has(status)
      ? { done: false, reason: 'upstream_error' }
      : { done: true, result: unavailable('upstream_error') };
  }

  private async parse(
    response: Response,
    contentId: string,
    requestId: string,
  ): Promise<PublicationLookupResult> {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isTimeout(error)) {
        this.logger.warn(
          `Content lookup timed out while reading the body (request ${requestId})`,
        );
        return unavailable('timeout');
      }
      body = undefined;
    }
    const parsed = publicationLookupSchema.safeParse(body);
    if (
      !parsed.success ||
      parsed.data.contentId.toLowerCase() !== contentId.toLowerCase()
    ) {
      this.logger.error(
        `Content answered an invalid publication lookup body (request ${requestId})`,
      );
      return unavailable('invalid_response');
    }
    const { publicationStatus } = parsed.data;
    return publicationStatus === 'published'
      ? { kind: 'published', contentId: parsed.data.contentId }
      : {
          kind: 'not_published',
          contentId: parsed.data.contentId,
          publicationStatus,
        };
  }
}
