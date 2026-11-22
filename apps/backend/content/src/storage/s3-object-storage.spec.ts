import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { ObjectNotFoundError, StorageUnavailableError } from './object-storage';
import { S3ObjectStorage, type S3Sender } from './s3-object-storage';

type Responder = (command: unknown) => unknown;

function storageWith(respond: Responder): {
  storage: S3ObjectStorage;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const client = {
    send: (command: unknown) => {
      sent.push(command);
      try {
        return Promise.resolve(respond(command));
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error('failure'),
        );
      }
    },
  } as unknown as S3Sender;
  return {
    storage: new S3ObjectStorage({
      client,
      bucket: 'lova-media',
      prefix: 'content/',
    }),
    sent,
  };
}

function s3Error(name: string, httpStatusCode: number): Error {
  const error = new Error(`${name} for secret-request-detail`);
  error.name = name;
  return Object.assign(error, { $metadata: { httpStatusCode } });
}

describe('S3ObjectStorage', () => {
  it('reads an inclusive byte range under the Content prefix', async () => {
    const body = Readable.from([Buffer.from('data')]);
    const { storage, sent } = storageWith(() => ({ Body: body }));

    await expect(
      storage.read('items/a/b', { start: 10, end: 19 }),
    ).resolves.toBe(body);
    const command = sent[0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'lova-media',
      Key: 'content/items/a/b',
      Range: 'bytes=10-19',
    });
  });

  it('reads a whole object without a Range', async () => {
    const { storage, sent } = storageWith(() => ({ Body: Readable.from([]) }));
    await storage.read('key');
    expect((sent[0] as GetObjectCommand).input.Range).toBeUndefined();
  });

  it.each([
    ['NoSuchKey', 404],
    ['UnknownError', 404],
  ])('maps a missing object on read (%s)', async (name, status) => {
    const { storage } = storageWith(() => {
      throw s3Error(name, status);
    });
    await expect(storage.read('key')).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it('reports other failures without the SDK message', async () => {
    const { storage } = storageWith(() => {
      throw s3Error('AccessDenied', 403);
    });
    const error = await storage.read('key').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageUnavailableError);
    expect((error as Error).message).toContain('AccessDenied');
    expect((error as Error).message).not.toContain('secret-request-detail');
  });

  it('rejects a body that is not a stream', async () => {
    const { storage } = storageWith(() => ({ Body: 'text' }));
    await expect(storage.read('key')).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
  });

  it('writes a stream with its type and length', async () => {
    const body = Readable.from([Buffer.from('data')]);
    const { storage, sent } = storageWith(() => ({}));
    await storage.write('key', body, {
      contentType: 'image/png',
      contentLength: 4,
    });
    const command = sent[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'lova-media',
      Key: 'content/key',
      Body: body,
      ContentType: 'image/png',
      ContentLength: 4,
    });
  });

  it('reports a body error instead of a storage outage', async () => {
    const bodyError = new Error('invalid body');
    const body = new Readable({ read() {} });
    body.on('error', () => undefined);
    body.destroy(bodyError);
    const { storage } = storageWith(() => {
      throw s3Error('RequestAborted', 0);
    });
    await expect(
      storage.write('key', body, {
        contentType: 'image/png',
        contentLength: 4,
      }),
    ).rejects.toBe(bodyError);
  });

  it('deletes an object and ignores a missing one', async () => {
    const { storage, sent } = storageWith(() => ({}));
    await storage.delete('key');
    const command = sent[0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'lova-media', Key: 'content/key' });

    const missing = storageWith(() => {
      throw s3Error('NoSuchKey', 404);
    });
    await expect(missing.storage.delete('key')).resolves.toBeUndefined();
  });

  it('reports a failed delete as a storage outage', async () => {
    const { storage } = storageWith(() => {
      throw s3Error('InternalError', 500);
    });
    await expect(storage.delete('key')).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
  });
});
