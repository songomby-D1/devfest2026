import { Readable } from 'node:stream';
import type { UploadSource } from '../../src/media/multipart-upload';

export const BOUNDARY = 'test-boundary-7d1f';

export type Part =
  | {
      readonly name: string;
      readonly filename: string;
      readonly type: string;
      readonly data: Buffer;
    }
  | { readonly name: string; readonly value: string };

/** Builds a multipart/form-data body by hand. */
export function multipartBody(parts: readonly Part[]): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if ('data' in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.type}\r\n\r\n`,
        ),
        part.data,
        Buffer.from('\r\n'),
      );
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`,
        ),
      );
    }
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

export function filePart(
  data: Buffer,
  type: string,
  filename = '../../etc/passwd.jpg',
): Part {
  return { name: 'file', filename, type, data };
}

/** An upload source as the controller builds it from the request. */
export function uploadSource(
  parts: readonly Part[],
  contentType = `multipart/form-data; boundary=${BOUNDARY}`,
): UploadSource {
  const body = multipartBody(parts);
  return {
    headers: {
      'content-type': contentType,
      'content-length': String(body.length),
    },
    stream: Readable.from([body]),
  };
}
