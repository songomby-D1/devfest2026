import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** Inclusive byte range, as in an HTTP Range header. */
export interface ObjectRange {
  readonly start: number;
  readonly end: number;
}

export interface ObjectWrite {
  readonly contentType: string;
  readonly contentLength: number;
}

/**
 * Private object store scoped to the Content service (D05). Keys are relative
 * to the service's bucket and prefix; they are never exposed to clients.
 * Adapted from the LiDAR service; no code is shared across services (D14).
 */
export interface ObjectStorage {
  /** @throws ObjectNotFoundError when the object does not exist. */
  read(key: string, range?: ObjectRange): Promise<Readable>;
  /** Fails, without keeping a partial object, when the body stream errors. */
  write(key: string, body: Readable, options: ObjectWrite): Promise<void>;
  /** Succeeds when the object is already absent. */
  delete(key: string): Promise<void>;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Stored object not found');
    this.name = 'ObjectNotFoundError';
  }
}

export class StorageUnavailableError extends Error {
  constructor(reason: string) {
    super(`Object storage unavailable: ${reason}`);
    this.name = 'StorageUnavailableError';
  }
}
