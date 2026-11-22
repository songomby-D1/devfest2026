export const CONTENT_DIRECTORY = Symbol('CONTENT_DIRECTORY');

export interface ContentDirectory {
  /** @throws ContentDirectoryUnavailableError when publication cannot be confirmed. */
  isPublished(contentId: string): Promise<boolean>;
}

export class ContentDirectoryUnavailableError extends Error {
  constructor(reason: string) {
    super(`Content directory unavailable: ${reason}`);
    this.name = 'ContentDirectoryUnavailableError';
  }
}
