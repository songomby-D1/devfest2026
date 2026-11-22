import { z } from 'zod';

export const MESHY_CLIENT = Symbol('MESHY_CLIENT');

export type MeshyTaskStatus =
  'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

/** The fields LiDAR reads from a Meshy image-to-3D task. */
export interface MeshyTask {
  readonly id: string;
  readonly status: MeshyTaskStatus;
  /** 0 to 100. */
  readonly progress: number;
  readonly glbUrl: string | null;
  readonly thumbnailUrl: string | null;
  /** Meshy's error code (e.g. `moderation_blocked`), never shown verbatim to the visitor. */
  readonly errorCode: string | null;
}

export interface ImageTo3dRequest {
  /** `data:image/jpeg;base64,...` or `data:image/png;base64,...`. */
  readonly imageDataUri: string;
  readonly texturePrompt?: string | undefined;
}

export interface MeshyDownload {
  readonly bytes: Buffer;
  readonly contentType: string;
}

/** Port over the Meshy API, faked in tests. */
export interface MeshyClient {
  createImageTo3d(request: ImageTo3dRequest): Promise<string>;
  getImageTo3d(taskId: string): Promise<MeshyTask>;
  /** Downloads a signed asset URL from the task, up to `maxBytes`. */
  download(url: string, maxBytes: number): Promise<MeshyDownload>;
}

/** Why a Meshy call failed, mapped to public errors by the service. */
export type MeshyFailure =
  | 'rejected' // 400, 403, 422: input refused (format, moderation)
  | 'credits' // 402
  | 'busy' // 429
  | 'not_found' // 404
  | 'unavailable'; // 401, 5xx, network, timeout, malformed answer

export class MeshyError extends Error {
  constructor(
    readonly failure: MeshyFailure,
    readonly status: number,
  ) {
    super(`Meshy request failed (${failure}, HTTP ${String(status)})`);
    this.name = 'MeshyError';
  }
}

const createdSchema = z.object({ result: z.string().min(1).max(128) });

const taskSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'CANCELED']),
  progress: z.number().min(0).max(100).catch(0),
  model_urls: z
    .object({ glb: z.string().optional() })
    .partial()
    .nullish()
    .catch(null),
  thumbnail_url: z.string().nullish().catch(null),
  task_error: z
    .object({ code: z.string().nullish(), type: z.string().nullish() })
    .nullish()
    .catch(null),
});

/** Meshy only serves assets from its CDN; anything else is refused before fetching. */
const ASSET_HOST = /^(?:[a-z0-9-]+\.)*meshy\.ai$/;

function failureFor(status: number): MeshyFailure {
  if (status === 402) return 'credits';
  if (status === 429) return 'busy';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 403 || status === 422) return 'rejected';
  return 'unavailable';
}

export interface HttpMeshyClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly downloadTimeoutMs: number;
  readonly fetch: typeof fetch;
}

/** Meshy image-to-3D over HTTPS (https://docs.meshy.ai/en/api/image-to-3d). */
export class HttpMeshyClient implements MeshyClient {
  constructor(private readonly options: HttpMeshyClientOptions) {}

  async createImageTo3d(request: ImageTo3dRequest): Promise<string> {
    const body: Record<string, unknown> = {
      image_url: request.imageDataUri,
      ai_model: 'latest',
      should_texture: true,
      enable_pbr: true,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: 30000,
      target_formats: ['glb'],
      origin_at: 'bottom',
      moderation: true,
    };
    if (request.texturePrompt !== undefined && request.texturePrompt !== '') {
      body.texture_prompt = request.texturePrompt;
    }
    const answer = await this.call('POST', '/openapi/v1/image-to-3d', body);
    const parsed = createdSchema.safeParse(answer);
    if (!parsed.success) throw new MeshyError('unavailable', 200);
    return parsed.data.result;
  }

  async getImageTo3d(taskId: string): Promise<MeshyTask> {
    const answer = await this.call(
      'GET',
      `/openapi/v1/image-to-3d/${encodeURIComponent(taskId)}`,
    );
    const parsed = taskSchema.safeParse(answer);
    if (!parsed.success) throw new MeshyError('unavailable', 200);
    const task = parsed.data;
    return {
      id: task.id,
      status: task.status,
      progress: task.progress,
      glbUrl: task.model_urls?.glb ?? null,
      thumbnailUrl: task.thumbnail_url ?? null,
      errorCode: task.task_error?.code ?? task.task_error?.type ?? null,
    };
  }

  async download(url: string, maxBytes: number): Promise<MeshyDownload> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new MeshyError('unavailable', 0);
    }
    if (parsed.protocol !== 'https:' || !ASSET_HOST.test(parsed.hostname)) {
      throw new MeshyError('unavailable', 0);
    }
    const response = await this.fetchWithTimeout(
      parsed.toString(),
      { method: 'GET', redirect: 'error' },
      this.options.downloadTimeoutMs,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new MeshyError(failureFor(response.status), response.status);
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel();
      throw new MeshyError('rejected', 413);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new MeshyError('rejected', 413);
    return {
      bytes,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = new URL(path, this.options.baseUrl);
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.options.apiKey}`,
      accept: 'application/json',
    };
    const init: RequestInit = { method, headers, redirect: 'error' };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await this.fetchWithTimeout(
      url.toString(),
      init,
      this.options.timeoutMs,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new MeshyError(failureFor(response.status), response.status);
    }
    try {
      return await response.json();
    } catch {
      throw new MeshyError('unavailable', response.status);
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    try {
      return await this.options.fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new MeshyError('unavailable', 0);
    }
  }
}
