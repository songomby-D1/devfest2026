import { Transform, type TransformCallback } from 'node:stream';
import type { FileSignature } from './asset-file-variant.js';

const SIGNATURE_LENGTH = 12;

const MATCHERS: Readonly<Record<FileSignature, (head: Buffer) => boolean>> = {
  // GLB header magic "glTF" (glTF 2.0, section 4.4.3).
  glb: (head) => head.toString('latin1', 0, 4) === 'glTF',
  // RIFF container whose form type is "WEBP".
  webp: (head) =>
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP',
  // USDZ is an uncompressed ZIP archive starting with a local file header.
  zip: (head) => head.readUInt32BE(0) === 0x504b0304,
};

export class InvalidFileError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidFileError';
  }
}

/**
 * Passes bytes through while checking the file signature and the exact byte
 * count. It errors, which aborts the storage write, on the first mismatch.
 */
export class FileValidationStream extends Transform {
  private head = Buffer.alloc(0);
  private checked = false;
  private received = 0;

  constructor(
    private readonly signature: FileSignature,
    private readonly expectedBytes: number,
  ) {
    super();
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.received += chunk.length;
    if (this.received > this.expectedBytes) {
      callback(new InvalidFileError('body is longer than declared'));
      return;
    }
    if (!this.checked) {
      this.head = Buffer.concat([this.head, chunk]);
      if (this.head.length >= SIGNATURE_LENGTH) {
        const error = this.checkSignature();
        if (error) {
          callback(error);
          return;
        }
      }
    }
    callback(null, chunk);
  }

  override _flush(callback: TransformCallback): void {
    if (this.received !== this.expectedBytes) {
      callback(new InvalidFileError('body is shorter than declared'));
      return;
    }
    callback(this.checked ? null : this.checkSignature());
  }

  private checkSignature(): InvalidFileError | null {
    this.checked = true;
    const valid =
      this.head.length >= SIGNATURE_LENGTH &&
      MATCHERS[this.signature](this.head);
    this.head = Buffer.alloc(0);
    return valid
      ? null
      : new InvalidFileError('file signature does not match the variant');
  }
}
