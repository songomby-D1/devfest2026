import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

/** Request headers a browser may send that services need. Everything else is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
] as const;

/** Response headers relayed to the browser. Upstream cookies and locations are never relayed. */
const RELAYED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
  'content-disposition',
] as const;

export function forwardedHeaders(
  request: ExpressRequest,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  return headers;
}

export async function relay(
  upstream: Response,
  response: ExpressResponse,
): Promise<void> {
  response.status(upstream.status);
  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) response.setHeader(name, value);
  }
  if (upstream.body === null) {
    response.end();
    return;
  }
  await pipeline(
    Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>),
    response,
  );
}
