import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform, type Readable, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpStatus } from '@nestjs/common';
import busboy from 'busboy';
import { PublicError } from '../common/public-error';
import { SIGNATURE_BYTES } from './media-format';

export const FILE_FIELD = 'file';
export const CAPTION_FIELD = 'caption';
/** Room for a 300-character caption in multi-byte UTF-8. */
const MAX_FIELD_BYTES = 2048;

/** An upload written to a private temporary file, never kept in memory. */
export interface SpooledFile {
  /** Temporary path; the client filename is never used. */
  readonly path: string;
  readonly bytes: number;
  /** Lowercase hex SHA-256 of the whole file. */
  readonly sha256: string;
  /** First bytes, for the signature check. */
  readonly head: Buffer;
  /** Part Content-Type as sent by the client; checked against the signature. */
  readonly declaredType: string;
}

export interface ReceivedUpload {
  readonly file: SpooledFile;
  /** Raw caption field, validated by the service. */
  readonly caption: string | undefined;
  /** Removes the temporary file. Safe to call more than once. */
  dispose(): Promise<void>;
}

export interface UploadSource {
  readonly headers: IncomingHttpHeaders;
  readonly stream: Readable;
}

export function payloadTooLarge(maxBytes: number): PublicError {
  return new PublicError(
    'PAYLOAD_TOO_LARGE',
    `The file exceeds the ${String(maxBytes)} byte limit`,
    HttpStatus.PAYLOAD_TOO_LARGE,
  );
}

function invalid(field: string, reason: string): PublicError {
  return PublicError.validation([{ field, reason }]);
}

/** Hashes, counts and keeps the first bytes of a stream as it passes. */
class FileDigest extends Transform {
  readonly hash = createHash('sha256');
  bytes = 0;
  head = Buffer.alloc(0);

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.hash.update(chunk);
    this.bytes += chunk.length;
    if (this.head.length < SIGNATURE_BYTES) {
      this.head = Buffer.concat([this.head, chunk]).subarray(
        0,
        SIGNATURE_BYTES,
      );
    }
    callback(null, chunk);
  }
}

/**
 * Reads a `multipart/form-data` body with one `file` part and an optional
 * `caption` field (Gate 0 `uploadMedia`). The file is streamed to a private
 * temporary directory while its size, SHA-256 and first bytes are computed,
 * so that it can be checked before anything reaches object storage.
 */
export async function receiveUpload(
  source: UploadSource,
  maxFileBytes: number,
): Promise<ReceivedUpload> {
  const contentType = source.headers['content-type'];
  if (
    typeof contentType !== 'string' ||
    !/^multipart\/form-data\s*;/i.test(contentType)
  ) {
    throw new PublicError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Send the file as multipart/form-data',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
  const declaredLength = Number(source.headers['content-length']);
  // The envelope adds a few hundred bytes; anything far beyond the limit is refused early.
  if (declaredLength > maxFileBytes + 64 * 1024) {
    throw payloadTooLarge(maxFileBytes);
  }

  const directory = await mkdtemp(join(tmpdir(), 'content-upload-'));
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    const parsed = await parse(source, maxFileBytes, join(directory, 'file'));
    return { ...parsed, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

function parse(
  source: UploadSource,
  maxFileBytes: number,
  path: string,
): Promise<Omit<ReceivedUpload, 'dispose'>> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: source.headers,
        limits: {
          fileSize: maxFileBytes,
          files: 1,
          fields: 1,
          parts: 2,
          fieldSize: MAX_FIELD_BYTES,
          fieldNameSize: 64,
          headerPairs: 20,
        },
      });
    } catch {
      reject(invalid('body', 'must be multipart/form-data with a boundary'));
      return;
    }

    let failure: Error | null = null;
    let caption: string | undefined;
    let written: Promise<SpooledFile> | null = null;

    const fail = (cause: unknown): void => {
      if (failure !== null) return;
      const error = cause instanceof Error ? cause : new Error('Upload failed');
      failure = error;
      // Drain the rest of the body so that the error response is delivered,
      // and stop the parser, which also ends the file part being written.
      source.stream.unpipe(parser);
      source.stream.resume();
      parser.destroy();
      // Reject once the temporary file is closed, so that it can be removed.
      const settled: Promise<unknown> = written ?? Promise.resolve();
      const rejectWithError = (): void => {
        reject(error);
      };
      settled.then(rejectWithError, rejectWithError);
    };

    parser.on('file', (name, stream, info) => {
      if (name !== FILE_FIELD || written !== null) {
        stream.resume();
        fail(invalid(name, 'is not allowed'));
        return;
      }
      stream.on('limit', () => {
        fail(payloadTooLarge(maxFileBytes));
      });
      const digest = new FileDigest();
      written = pipeline(
        stream,
        digest,
        createWriteStream(path, { mode: 0o600 }),
      ).then(() => ({
        path,
        bytes: digest.bytes,
        sha256: digest.hash.digest('hex'),
        head: digest.head,
        declaredType: info.mimeType,
      }));
      written.catch((error: unknown) => {
        fail(error);
      });
    });

    parser.on('field', (name, value, info) => {
      if (name !== CAPTION_FIELD || caption !== undefined) {
        fail(invalid(name, 'is not allowed'));
      } else if (info.valueTruncated) {
        fail(invalid(CAPTION_FIELD, 'is too long'));
      } else {
        caption = value;
      }
    });

    const tooManyParts = (): void => {
      fail(invalid('body', 'must hold one file and at most one caption'));
    };
    parser.on('filesLimit', tooManyParts);
    // `partsLimit` fires on reaching the limit, not exceeding it; any third
    // part already exceeds the file or field limit above.
    parser.on('fieldsLimit', tooManyParts);
    parser.on('error', () => {
      fail(invalid('body', 'is not valid multipart'));
    });

    parser.on('close', () => {
      if (failure !== null) return;
      if (written === null) {
        fail(invalid(FILE_FIELD, 'is required'));
        return;
      }
      written.then(
        (file) => {
          if (failure !== null) return;
          if (file.bytes === 0) {
            fail(invalid(FILE_FIELD, 'must not be empty'));
            return;
          }
          resolve({ file, caption });
        },
        (error: unknown) => {
          fail(error);
        },
      );
    });

    source.stream.on('aborted', () => {
      fail(invalid('body', 'the upload was interrupted'));
    });
    source.stream.pipe(parser);
  });
}
