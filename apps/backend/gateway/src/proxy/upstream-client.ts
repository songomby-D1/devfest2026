import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Permission, UpstreamName } from '@devfest2026/shared';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GatewayError, genericError } from '../common/public-error.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Identity forwarded to services. `userId` is null for guests. */
export interface ForwardedCaller {
  readonly userId: string | null;
  readonly permissions: readonly Permission[];
}

export interface UpstreamRequest {
  readonly service: UpstreamName;
  readonly method: HttpMethod;
  /** Already encoded, starting with `/`. */
  readonly path: string;
  readonly search?: string;
  readonly requestId: string;
  readonly timeoutMs: number;
  readonly caller?: ForwardedCaller | undefined;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | ReadableStream<Uint8Array> | undefined;
  /** Aborts the upstream call, for example when the browser disconnects. */
  readonly signal?: AbortSignal | undefined;
}

const SERVICE_LABEL: Readonly<Record<UpstreamName, string>> = {
  auth: 'account',
  content: 'collection',
  nft: 'provenance',
  lidar: '3D',
};

const MAX_ERROR_BODY_BYTES = 64 * 1024;
const PUBLIC_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_PUBLIC_MESSAGE_LENGTH = 500;

export function unavailable(service: UpstreamName): GatewayError {
  return new GatewayError(
    503,
    `${service.toUpperCase()}_UNAVAILABLE`,
    `The ${SERVICE_LABEL[service]} service is unavailable. Try again shortly.`,
  );
}

export function upstreamFailure(): GatewayError {
  return new GatewayError(
    502,
    'UPSTREAM_ERROR',
    'The service could not complete the request.',
  );
}

/**
 * Sends requests to internal services with the service credentials and caller context of the
 * platform contract. Headers are built from scratch, so client-supplied `x-caller-*` and
 * `x-service-*` headers are never forwarded.
 */
@Injectable()
export class UpstreamClient {
  private readonly logger = new Logger(UpstreamClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async send(request: UpstreamRequest): Promise<Response> {
    const upstream = this.config.upstreams[request.service];
    const url = new URL(upstream.url);
    url.pathname = joinPaths(url.pathname, request.path);
    url.search = request.search ?? '';

    const headers: Record<string, string> = {
      ...request.headers,
      'x-service-name': 'gateway',
      'x-service-token': upstream.token,
      'x-request-id': request.requestId,
    };
    if (request.caller !== undefined) {
      if (request.caller.userId !== null) {
        headers['x-caller-user-id'] = request.caller.userId;
      }
      headers['x-caller-permissions'] = request.caller.permissions.join(',');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, request.timeoutMs);
    const onClientAbort = (): void => {
      controller.abort();
    };
    request.signal?.addEventListener('abort', onClientAbort, { once: true });
    try {
      const init: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers,
        signal: controller.signal,
        redirect: 'manual',
      };
      if (request.body !== undefined) {
        init.body = request.body;
        if (typeof request.body !== 'string') init.duplex = 'half';
      }
      return await fetch(url, init);
    } catch (error) {
      this.logger.warn(
        `${request.service} unreachable: ${error instanceof Error ? error.name : 'UnknownError'} (requestId=${request.requestId})`,
      );
      throw unavailable(request.service);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onClientAbort);
    }
  }

  /** Maps a non-2xx upstream answer to a public error without leaking upstream details. */
  async toPublicError(
    service: UpstreamName,
    response: Response,
    requestId: string,
  ): Promise<GatewayError> {
    const body = await readJsonCapped(response);
    if (response.status === 503) return unavailable(service);
    if (response.status >= 500) {
      this.logger.error(
        `${service} answered ${String(response.status)} (requestId=${requestId})`,
      );
      return upstreamFailure();
    }
    if (isPublicErrorBody(body)) {
      if (body.code === 'SERVICE_UNAUTHENTICATED') {
        // The gateway's own service token was refused: a deployment problem, not the client's.
        this.logger.error(
          `${service} refused the gateway service token (requestId=${requestId})`,
        );
        return upstreamFailure();
      }
      return new GatewayError(
        response.status,
        body.code,
        body.message,
        response.status === 400 ? validDetails(body.details) : undefined,
      );
    }
    return genericError(response.status);
  }
}

interface PublicErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

function isPublicErrorBody(value: unknown): value is PublicErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    PUBLIC_CODE_PATTERN.test(value.code) &&
    'message' in value &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    value.message.length <= MAX_PUBLIC_MESSAGE_LENGTH
  );
}

function validDetails(
  value: unknown,
): readonly { field: string; reason: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const details = value.filter(
    (entry: unknown): entry is { field: string; reason: string } =>
      typeof entry === 'object' &&
      entry !== null &&
      'field' in entry &&
      typeof entry.field === 'string' &&
      'reason' in entry &&
      typeof entry.reason === 'string',
  );
  return details.length > 0
    ? details.slice(0, 50).map(({ field, reason }) => ({ field, reason }))
    : undefined;
}

export async function readJsonCapped(response: Response): Promise<unknown> {
  if (response.body === null) return undefined;
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ERROR_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function joinPaths(base: string, path: string): string {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmedBase}${path}`;
}
