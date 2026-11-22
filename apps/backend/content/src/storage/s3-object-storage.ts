import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  ObjectNotFoundError,
  type ObjectRange,
  type ObjectStorage,
  type ObjectWrite,
  StorageUnavailableError,
} from './object-storage';

const HTTP_NOT_FOUND = 404;
const NOT_FOUND_NAMES = new Set(['NotFound', 'NoSuchKey']);

/** The subset of S3Client used here, so tests can pass a fake. */
export type S3Sender = Pick<S3Client, 'send'>;

export interface S3ObjectStorageOptions {
  readonly client: S3Sender;
  readonly bucket: string;
  /** Empty, or a relative prefix ending with "/". */
  readonly prefix: string;
}

export class S3ObjectStorage implements ObjectStorage {
  constructor(private readonly options: S3ObjectStorageOptions) {}

  async read(key: string, range?: ObjectRange): Promise<Readable> {
    try {
      const object = await this.options.client.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: this.key(key),
          Range: range && `bytes=${String(range.start)}-${String(range.end)}`,
        }),
      );
      if (!(object.Body instanceof Readable)) {
        throw new StorageUnavailableError('unexpected body type');
      }
      return object.Body;
    } catch (error) {
      if (isNotFound(error)) throw new ObjectNotFoundError();
      throw toStorageError(error);
    }
  }

  async write(
    key: string,
    body: Readable,
    options: ObjectWrite,
  ): Promise<void> {
    try {
      await this.options.client.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: this.key(key),
          Body: body,
          ContentType: options.contentType,
          ContentLength: options.contentLength,
        }),
      );
    } catch (error) {
      // A body failure is reported as is, not as a storage outage.
      if (body.errored) throw body.errored;
      throw toStorageError(error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.options.client.send(
        new DeleteObjectCommand({
          Bucket: this.options.bucket,
          Key: this.key(key),
        }),
      );
    } catch (error) {
      if (isNotFound(error)) return;
      throw toStorageError(error);
    }
  }

  private key(key: string): string {
    return `${this.options.prefix}${key}`;
  }
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode;
  return NOT_FOUND_NAMES.has(error.name) || status === HTTP_NOT_FOUND;
}

// Only the error name is kept: SDK messages can echo request details.
function toStorageError(error: unknown): Error {
  if (error instanceof StorageUnavailableError) return error;
  return new StorageUnavailableError(
    error instanceof Error ? error.name : 'request failed',
  );
}
