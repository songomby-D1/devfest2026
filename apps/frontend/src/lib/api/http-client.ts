import { ApiError, type ApiClient } from './client';
import type { ApiErrorBody, MintRecord } from './contract';
import { toModel3d } from './model3d-adapter';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const UNKNOWN_ERROR: Omit<ApiErrorBody, 'requestId'> = {
  code: 'UNKNOWN_ERROR',
  message: 'Le service est momentanément indisponible.',
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.code === 'string' &&
    typeof body.message === 'string' &&
    typeof body.requestId === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body)) return new ApiError(response.status, body);
  return new ApiError(response.status, { ...UNKNOWN_ERROR, requestId: '' });
}

/** Calls the gateway on the same origin, under `/api`. */
export function createHttpClient(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  baseUrl = '/api',
): ApiClient {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      credentials: 'same-origin',
      ...init,
    });
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await send(path, init);
    return (await response.json()) as T;
  }

  function postJson<T>(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  const item = (id: string) => `/items/${encodeURIComponent(id)}`;

  return {
    listItems: () => request('/items'),
    getItem: (id) => request(item(id)),
    createItem: (newItem) => postJson('/items', newItem),
    uploadMedia: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`${item(id)}/media`, { method: 'POST', body: form });
    },
    reviewItem: (id, decision) => postJson(`${item(id)}/review`, decision),
    // 202 creates a pending mint, 200 replays the mint of a known key.
    mintItem: async (id, idempotencyKey) => {
      const response = await send(`${item(id)}/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: '{}',
      });
      const mint = (await response.json()) as MintRecord;
      return { created: response.status === 202, mint };
    },
    getProvenance: (id) => request(`${item(id)}/provenance`),
    getModel3d: async (id) =>
      toModel3d(id, await request<unknown>(`${item(id)}/model3d`)),
  };
}
