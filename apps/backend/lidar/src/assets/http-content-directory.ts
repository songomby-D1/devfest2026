import { z } from 'zod';
import {
  type ContentDirectory,
  ContentDirectoryUnavailableError,
} from './content-directory.js';

// Provisional contract until Content (CONTENT-02) publishes its API: GET /contents/:id -> { status }.
const contentItemSchema = z.object({ status: z.string() });
const PUBLISHED_STATUS = 'published';
const HTTP_NOT_FOUND = 404;

export type FetchFunction = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export interface HttpContentDirectoryOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetch: FetchFunction;
}

export class HttpContentDirectory implements ContentDirectory {
  constructor(private readonly options: HttpContentDirectoryOptions) {}

  async isPublished(contentId: string): Promise<boolean> {
    const response = await this.request(contentId);
    if (response.status === HTTP_NOT_FOUND) return false;
    if (!response.ok)
      throw new ContentDirectoryUnavailableError(
        `HTTP ${String(response.status)}`,
      );

    const item = contentItemSchema.safeParse(await this.readJson(response));
    if (!item.success)
      throw new ContentDirectoryUnavailableError('unexpected response body');
    return item.data.status === PUBLISHED_STATUS;
  }

  private async request(contentId: string): Promise<Response> {
    const url = new URL(
      `contents/${encodeURIComponent(contentId)}`,
      withTrailingSlash(this.options.baseUrl),
    );
    try {
      return await this.options.fetch(url.toString(), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new ContentDirectoryUnavailableError(
        error instanceof Error ? error.name : 'request failed',
      );
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new ContentDirectoryUnavailableError('invalid JSON');
    }
  }
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
