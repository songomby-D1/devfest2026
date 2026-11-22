import { ApiError, NETWORK_ERROR_CODE, type ApiClient } from './client';
import type {
  ApiErrorBody,
  Generation,
  ItemListQuery,
  MintRecord,
  UploadOptions,
} from './contract';
import { toModel3d } from './model3d-adapter';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Sends a multipart body and reports upload progress, which fetch cannot do. */
export type UploadTransport = (
  url: string,
  body: FormData,
  options: UploadOptions,
) => Promise<{ status: number; body: unknown }>;

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

function errorFrom(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) return new ApiError(status, body);
  return new ApiError(status, { ...UNKNOWN_ERROR, requestId: '' });
}

function networkError(): ApiError {
  return new ApiError(0, {
    code: NETWORK_ERROR_CODE,
    message: 'Connexion au serveur impossible. Vérifiez votre réseau.',
    requestId: '',
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  return errorFrom(response.status, body);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** XMLHttpRequest upload with progress events, on the same origin. */
export const xhrUpload: UploadTransport = (url, body, options) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.withCredentials = true;
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener('load', () => {
      resolve({
        status: request.status,
        body: parseJson(request.responseText),
      });
    });
    request.addEventListener('error', () => {
      reject(networkError());
    });
    request.addEventListener('abort', () => {
      reject(networkError());
    });
    options.signal?.addEventListener('abort', () => {
      request.abort();
    });
    request.send(body);
  });

export function itemListSearch(query: ItemListQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search === '' ? '' : `?${search}`;
}

/** Calls the gateway on the same origin, under `/api`. */
export function createHttpClient(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  baseUrl = '/api',
  upload: UploadTransport = xhrUpload,
): ApiClient {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        credentials: 'same-origin',
        ...init,
      });
    } catch {
      throw networkError();
    }
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
    register: (body) => postJson('/auth/register', body),
    login: (body) => postJson('/auth/login', body),
    logout: async () => {
      await send('/auth/logout', { method: 'POST' });
    },
    me: () => request('/auth/me'),
    listItems: (query) => request(`/items${itemListSearch(query)}`),
    getItem: (id) => request(item(id)),
    createItem: (newItem) => postJson('/items', newItem),
    uploadMedia: async (id, file, options = {}) => {
      const form = new FormData();
      // Busboy reads fields in order: the caption goes before the file.
      if (options.caption !== undefined && options.caption.trim() !== '') {
        form.append('caption', options.caption.trim());
      }
      form.append('file', file);
      const result = await upload(`${baseUrl}${item(id)}/media`, form, options);
      if (result.status < 200 || result.status >= 300) {
        throw errorFrom(result.status, result.body);
      }
      return result.body as Awaited<ReturnType<ApiClient['uploadMedia']>>;
    },
    reviewItem: (id, review) => postJson(`${item(id)}/review`, review),
    decideItem: (id, decision) => postJson(`${item(id)}/decision`, decision),
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
    createGeneration: (body) =>
      request<Generation>('/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    getGeneration: (id) =>
      request<Generation>(`/generations/${encodeURIComponent(id)}`),
    listGenerations: async () =>
      (await request<{ generations: Generation[] }>('/generations'))
        .generations,
  };
}
