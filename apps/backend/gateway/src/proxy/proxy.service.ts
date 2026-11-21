import { Readable, Transform, type TransformCallback } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import type { UpstreamName } from '@devfest2026/shared';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import {
  GatewayError,
  genericError,
  requestIdOf,
} from '../common/public-error.js';
import {
  type SessionMode,
  SessionResolver,
} from '../session/session-resolver.js';
import { forwardedHeaders, relay } from './relay.js';
import { type HttpMethod, UpstreamClient } from './upstream-client.js';

export interface ForwardRoute {
  readonly service: UpstreamName;
  readonly method: HttpMethod;
  /** Encoded upstream path. */
  readonly path: string;
  readonly session: SessionMode;
  /** `json` re-serializes the parsed body; `stream` relays a multipart upload. */
  readonly body?: 'json' | 'stream';
  /** Replaces the client body, for routes whose upstream body the gateway composes. */
  readonly composedBody?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly keepQuery?: boolean;
}

class ByteLimit extends Transform {
  exceeded = false;
  private seen = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.seen += chunk.length;
    if (this.seen > this.maxBytes) {
      this.exceeded = true;
      callback(genericError(413));
      return;
    }
    callback(null, chunk);
  }
}

/** Forwards a public route to its owning service with the caller context. */
@Injectable()
export class ProxyService {
  constructor(
    @Inject(UpstreamClient) private readonly upstream: UpstreamClient,
    @Inject(SessionResolver) private readonly sessions: SessionResolver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async forward(
    request: Request,
    response: Response,
    route: ForwardRoute,
  ): Promise<void> {
    const caller = await this.sessions.resolve(
      request,
      response,
      route.session,
    );
    const requestId = requestIdOf(request);
    const headers: Record<string, string> = {
      ...forwardedHeaders(request),
      ...route.headers,
    };
    const { body, limit } = this.prepareBody(request, route, headers);

    const disconnect = new AbortController();
    response.on('close', () => {
      if (!response.writableFinished) disconnect.abort();
    });

    let upstreamResponse: globalThis.Response;
    try {
      upstreamResponse = await this.upstream.send({
        service: route.service,
        method: route.method,
        path: route.path,
        search: route.keepQuery === true ? searchOf(request) : '',
        requestId,
        timeoutMs:
          route.body === 'stream'
            ? this.config.timeouts.uploadMs
            : this.config.timeouts.upstreamMs,
        caller: { userId: caller.userId, permissions: caller.permissions },
        headers,
        body,
        signal: disconnect.signal,
      });
    } catch (error) {
      if (limit?.exceeded === true) throw genericError(413);
      throw error;
    }
    if (upstreamResponse.status >= 400) {
      throw await this.upstream.toPublicError(
        route.service,
        upstreamResponse,
        requestId,
      );
    }
    await relay(upstreamResponse, response);
  }

  private prepareBody(
    request: Request,
    route: ForwardRoute,
    headers: Record<string, string>,
  ): {
    readonly body: string | ReadableStream<Uint8Array> | undefined;
    readonly limit?: ByteLimit;
  } {
    if (route.composedBody !== undefined) {
      headers['content-type'] = 'application/json';
      return { body: JSON.stringify(route.composedBody) };
    }
    if (route.body === 'json') {
      if (request.is('application/json') !== 'application/json') {
        throw genericError(415);
      }
      headers['content-type'] = 'application/json';
      return { body: JSON.stringify(request.body ?? null) };
    }
    if (route.body === 'stream') {
      const contentType = request.headers['content-type'];
      if (
        typeof contentType !== 'string' ||
        request.is('multipart/form-data') !== 'multipart/form-data'
      ) {
        throw genericError(415);
      }
      const declaredLength = Number(request.headers['content-length']);
      if (declaredLength > this.config.maxUploadBytes) {
        throw genericError(413);
      }
      headers['content-type'] = contentType;
      const limit = new ByteLimit(this.config.maxUploadBytes);
      return {
        body: Readable.toWeb(request.pipe(limit)) as ReadableStream<Uint8Array>,
        limit,
      };
    }
    return { body: undefined };
  }
}

export function searchOf(request: Request): string {
  return new URL(request.originalUrl, 'http://gateway.invalid').search;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * Re-encodes the part of the path after `prefix`, rejecting dot segments and unexpected
 * characters so that a wildcard route cannot reach other upstream paths.
 */
export function wildcardRest(request: Request, prefix: string): string {
  // The raw path is checked on purpose: URL parsing would resolve encoded dot segments first.
  const pathname = request.originalUrl.split('?', 1)[0] ?? '';
  if (!pathname.startsWith(prefix)) throw genericError(404);
  const segments = pathname.slice(prefix.length).split('/');
  const decoded = segments.map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return '';
    }
  });
  if (
    decoded.length === 0 ||
    decoded.some(
      (segment) =>
        !SAFE_SEGMENT.test(segment) || segment === '.' || segment === '..',
    )
  ) {
    throw new GatewayError(404, 'NOT_FOUND', 'The resource was not found.');
  }
  return decoded.map(encodeURIComponent).join('/');
}
