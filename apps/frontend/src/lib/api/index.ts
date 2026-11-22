import type { ApiClient } from './client';
import { createHttpClient } from './http-client';
import { createMockClient } from './mock-client';

export type ApiMode = 'mock' | 'gateway';

export function resolveApiMode(value: string | undefined): ApiMode {
  return value === 'mock' ? 'mock' : 'gateway';
}

export function createApiClient(mode: ApiMode): ApiClient {
  return mode === 'mock'
    ? createMockClient({ latencyMs: 300 })
    : createHttpClient();
}

let current: ApiClient | null = null;

function client(): ApiClient {
  current ??= createApiClient(resolveApiMode(import.meta.env.VITE_API_MODE));
  return current;
}

/** Replaces the client, for tests. Pass `null` to go back to the configured one. */
export function setApiClient(next: ApiClient | null): void {
  current = next;
}

/**
 * The client the app uses, chosen by VITE_API_MODE at build time. Each call
 * goes to the current client, so tests can swap it with `setApiClient`.
 */
export const api: ApiClient = new Proxy({} as ApiClient, {
  get: (_target, property): unknown => Reflect.get(client(), property),
});

export { ApiError, NETWORK_ERROR_CODE } from './client';
export type { ApiClient } from './client';
export type * from './contract';
export {
  ACCEPTED_MEDIA_TYPES,
  checkMediaFile,
  formatMegabytes,
  MEDIA_UPLOAD_LIMITS,
} from './media-limits';
export { describeError, type DisplayError } from './error-message';
