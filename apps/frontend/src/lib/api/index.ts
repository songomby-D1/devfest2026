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

/** The client the app uses, chosen by VITE_API_MODE at build time. */
export const api: ApiClient = createApiClient(
  resolveApiMode(import.meta.env.VITE_API_MODE),
);

export { ApiError } from './client';
export type { ApiClient } from './client';
export type * from './contract';
