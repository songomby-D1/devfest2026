import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pngBytes } from '../../test/support/media-bytes';
import { filePart, uploadSource } from '../../test/support/multipart';
import { PublicError } from '../common/public-error';
import { receiveUpload } from './multipart-upload';

async function failureOf(
  promise: Promise<unknown>,
): Promise<{ code: string; status: number; field?: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PublicError) {
      return {
        code: error.code,
        status: error.getStatus(),
        ...(error.details?.[0] === undefined
          ? {}
          : { field: error.details[0].field }),
      };
    }
    throw error;
  }
  throw new Error('Expected the upload to be refused');
}

describe('receiveUpload', () => {
  it('spools the file with its size, hash, head and declared type', async () => {
    const data = pngBytes(1000);
    const upload = await receiveUpload(
      uploadSource([
        filePart(data, 'image/png'),
        { name: 'caption', value: 'Front view' },
      ]),
      4096,
    );
    try {
      expect(upload.caption).toBe('Front view');
      expect(upload.file).toMatchObject({
        bytes: 1000,
        sha256: createHash('sha256').update(data).digest('hex'),
        declaredType: 'image/png',
      });
      expect(upload.file.head).toEqual(data.subarray(0, 64));
      expect(upload.file.path).not.toContain('passwd');
      await expect(readFile(upload.file.path)).resolves.toEqual(data);
    } finally {
      await upload.dispose();
    }
    await expect(stat(upload.file.path)).rejects.toThrow();
  });

  it('accepts the caption before the file and no caption at all', async () => {
    const first = await receiveUpload(
      uploadSource([
        { name: 'caption', value: 'x' },
        filePart(pngBytes(), 'image/png'),
      ]),
      4096,
    );
    expect(first.caption).toBe('x');
    await first.dispose();
    const second = await receiveUpload(
      uploadSource([filePart(pngBytes(), 'image/png')]),
      4096,
    );
    expect(second.caption).toBeUndefined();
    await second.dispose();
  });

  it('refuses a body that is not multipart with 415', async () => {
    await expect(
      failureOf(receiveUpload(uploadSource([], 'image/png'), 4096)),
    ).resolves.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 });
  });

  it('refuses a file over the limit with 413', async () => {
    await expect(
      failureOf(
        receiveUpload(
          uploadSource([filePart(pngBytes(5000), 'image/png')]),
          4096,
        ),
      ),
    ).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
  });

  it('refuses a declared length far over the limit before reading', async () => {
    const source = uploadSource([filePart(pngBytes(), 'image/png')]);
    await expect(
      failureOf(
        receiveUpload(
          {
            ...source,
            headers: { ...source.headers, 'content-length': '999999999' },
          },
          4096,
        ),
      ),
    ).resolves.toMatchObject({ status: 413 });
  });

  it.each([
    ['a missing file', [{ name: 'caption', value: 'x' }], 'file'],
    [
      'an unknown file field',
      [{ name: 'other', filename: 'a', type: 'image/png', data: pngBytes() }],
      'other',
    ],
    ['an unknown field', [{ name: 'title', value: 'x' }], 'title'],
    [
      'two files',
      [filePart(pngBytes(), 'image/png'), filePart(pngBytes(), 'image/png')],
      undefined,
    ],
    ['an empty file', [filePart(Buffer.alloc(0), 'image/png')], 'file'],
    [
      'a caption over the field limit',
      [
        filePart(pngBytes(), 'image/png'),
        { name: 'caption', value: 'é'.repeat(1100) },
      ],
      'caption',
    ],
  ] as const)('refuses %s with 400', async (_label, parts, field) => {
    const failure = await failureOf(receiveUpload(uploadSource(parts), 4096));
    expect(failure).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    if (field !== undefined) expect(failure.field).toBe(field);
  });

  it('refuses a multipart body without a boundary', async () => {
    await expect(
      failureOf(
        receiveUpload(uploadSource([], 'multipart/form-data; x=y'), 10),
      ),
    ).resolves.toMatchObject({ status: 400 });
  });
});
