import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  IpfsError,
  type IpfsFailureReason,
  type Pinner,
  type PinRequest,
  type PinResult,
} from './pinner';

export const PINATA_API_URL = 'https://api.pinata.cloud';

export interface PinataPinnerOptions {
  /** Pinata JWT. `undefined` or empty makes every pin fail `not_configured`. */
  readonly jwt: string | undefined;
  /** Budget for one upload, from the request to the parsed answer. */
  readonly timeoutMs: number;
  /** Overridden by tests only. */
  readonly apiUrl?: string;
  /** Extra attempts after a connection failure, a 429 or a 502, 503 or 504. */
  readonly retries?: number;
  readonly retryDelayMs?: number;
}

/** `pinFileToIPFS` answer; unknown keys are ignored. */
const pinResponseSchema = z.object({
  IpfsHash: z.string().regex(/^[A-Za-z0-9]{46,128}$/),
});

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

type Attempt =
  | { readonly done: true; readonly cid: string }
  | {
      readonly done: false;
      readonly reason: IpfsFailureReason;
      readonly retry: boolean;
    };

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
 * Pins through Pinata's `POST /pinning/pinFileToIPFS` (S21). JSON documents
 * are uploaded as files, so the CID covers exactly the canonical bytes the
 * builder produced. `cidVersion: 1` makes the CID a pure function of the
 * bytes: pinning the same snapshot again returns the same CID, and Pinata
 * reports it as a duplicate instead of storing a second copy.
 *
 * The JWT is only ever sent in the `Authorization` header. It is never
 * logged and never part of an error.
 */
export class PinataPinner implements Pinner {
  private readonly logger = new Logger(PinataPinner.name);
  private readonly apiUrl: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: PinataPinnerOptions) {
    this.apiUrl = (options.apiUrl ?? PINATA_API_URL).replace(/\/+$/, '');
    this.retries = options.retries ?? 1;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  async pin(request: PinRequest, requestId: string): Promise<PinResult> {
    const jwt = this.options.jwt;
    if (jwt === undefined || jwt === '') {
      this.logger.error(
        `IPFS pin skipped: PINATA_JWT is not set (request ${requestId})`,
      );
      throw new IpfsError('not_configured');
    }

    let reason: IpfsFailureReason = 'network';
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) await delay(this.retryDelayMs * attempt);
      const outcome = await this.attempt(request, requestId, jwt);
      if (outcome.done) return { cid: outcome.cid };
      reason = outcome.reason;
      if (!outcome.retry) break;
    }
    this.logger.warn(
      `IPFS pin of "${request.name}" failed: ${reason} (request ${requestId})`,
    );
    throw new IpfsError(reason);
  }

  private async attempt(
    request: PinRequest,
    requestId: string,
    jwt: string,
  ): Promise<Attempt> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Uint8Array.from(request.bytes)], { type: request.contentType }),
      request.name,
    );
    form.append(
      'pinataMetadata',
      JSON.stringify({ name: request.name, keyvalues: request.keyvalues }),
    );
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const signal = AbortSignal.timeout(this.options.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jwt}`, accept: 'application/json' },
        body: form,
        redirect: 'error',
        signal,
      });
    } catch (error) {
      if (isTimeout(error)) {
        return { done: false, reason: 'timeout', retry: false };
      }
      this.logger.warn(
        `Pinata unreachable: ${errorName(error)} (request ${requestId})`,
      );
      return { done: false, reason: 'network', retry: true };
    }

    const { status } = response;
    if (status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      this.logger.warn(
        `Pinata answered HTTP ${String(status)} (request ${requestId})`,
      );
      if (status === 401 || status === 403) {
        return { done: false, reason: 'unauthenticated', retry: false };
      }
      if (RETRYABLE_STATUSES.has(status)) {
        return { done: false, reason: 'upstream_error', retry: true };
      }
      return {
        done: false,
        reason: status >= 500 ? 'upstream_error' : 'rejected',
        retry: false,
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isTimeout(error)) {
        return { done: false, reason: 'timeout', retry: false };
      }
      body = undefined;
    }
    const parsed = pinResponseSchema.safeParse(body);
    if (!parsed.success) {
      return { done: false, reason: 'invalid_response', retry: false };
    }
    return { done: true, cid: parsed.data.IpfsHash };
  }
}
