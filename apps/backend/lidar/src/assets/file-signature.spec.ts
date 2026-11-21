import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { describe, expect, it } from 'vitest';
import {
  glbBytes,
  usdzBytes,
  webpBytes,
} from '../../test/support/in-memory-object-storage.js';
import type { FileSignature } from './asset-file-variant.js';
import { FileValidationStream, InvalidFileError } from './file-signature.js';

function validate(
  signature: FileSignature,
  data: Buffer,
  expectedBytes = data.length,
  chunkSize = 5,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    chunks.push(data.subarray(offset, offset + chunkSize));
  }
  return buffer(
    Readable.from(chunks).pipe(
      new FileValidationStream(signature, expectedBytes),
    ),
  );
}

describe('FileValidationStream', () => {
  it.each([
    ['glb', glbBytes(64)],
    ['webp', webpBytes(64)],
    ['zip', usdzBytes(64)],
  ] as const)(
    'passes a %s file through unchanged across chunks',
    async (signature, data) => {
      await expect(validate(signature, data)).resolves.toEqual(data);
    },
  );

  it('rejects a file whose signature does not match the variant', async () => {
    await expect(validate('glb', webpBytes(64))).rejects.toBeInstanceOf(
      InvalidFileError,
    );
  });

  it('rejects a body longer than declared', async () => {
    await expect(validate('glb', glbBytes(64), 32)).rejects.toThrow('longer');
  });

  it('rejects a body shorter than declared', async () => {
    await expect(validate('glb', glbBytes(64), 128)).rejects.toThrow('shorter');
  });

  it('rejects a body too short to carry a signature', async () => {
    await expect(validate('glb', Buffer.from('glTF'))).rejects.toThrow(
      'signature',
    );
  });
});
