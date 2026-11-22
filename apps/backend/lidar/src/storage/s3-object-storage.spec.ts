import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import {
  ObjectNotFoundError,
  StorageUnavailableError,
} from './object-storage.js';
import { S3ObjectStorage, type S3Sender } from './s3-object-storage.js';

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
      bucket: 'lidar-assets',
      prefix: 'lidar/',
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
  it('stats an object under the LiDAR prefix', async () => {
    const { storage, sent } = storageWith(() => ({
      ContentLength: 42,
      ETag: '"abc"',
    }));
    await expect(storage.stat('asset/model-1k.glb')).resolves.toEqual({
      size: 42,
      etag: '"abc"',
    });
    const command = sent[0] as HeadObjectCommand;
    expect(command).toBeInstanceOf(HeadObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'lidar-assets',
      Key: 'lidar/asset/model-1k.glb',
    });
  });

  it.each([
    ['NotFound', 404],
    ['NoSuchKey', 404],
    ['UnknownError', 404],
  ])('returns null when the object is missing (%s)', async (name, status) => {
    const { storage } = storageWith(() => {
      throw s3Error(name, status);
    });
    await expect(storage.stat('missing')).resolves.toBeNull();
  });

  it('reports other failures without the SDK message', async () => {
    const { storage } = storageWith(() => {
      throw s3Error('AccessDenied', 403);
    });
    const error = await storage.stat('key').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageUnavailableError);
    expect((error as Error).message).toContain('AccessDenied');
    expect((error as Error).message).not.toContain('secret-request-detail');
  });

  it('reads an inclusive byte range', async () => {
    const body = Readable.from([Buffer.from('data')]);
    const { storage, sent } = storageWith(() => ({ Body: body }));
    await expect(storage.read('key', { start: 10, end: 19 })).resolves.toBe(
      body,
    );
    const command = sent[0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({
      Key: 'lidar/key',
      Range: 'bytes=10-19',
    });
  });

  it('reads a whole object without a Range', async () => {
    const { storage, sent } = storageWith(() => ({ Body: Readable.from([]) }));
    await storage.read('key');
    expect((sent[0] as GetObjectCommand).input.Range).toBeUndefined();
  });

  it('maps a missing object on read', async () => {
    const { storage } = storageWith(() => {
      throw s3Error('NoSuchKey', 404);
    });
    await expect(storage.read('key')).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
  });

  it('writes a stream with its type and length', async () => {
    const body = Readable.from([Buffer.from('glTF')]);
    const { storage, sent } = storageWith(() => ({}));
    await storage.write('key', body, {
      contentType: 'model/gltf-binary',
      contentLength: 4,
    });
    const command = sent[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'lidar-assets',
      Key: 'lidar/key',
      Body: body,
      ContentType: 'model/gltf-binary',
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
        contentType: 'model/gltf-binary',
        contentLength: 4,
      }),
    ).rejects.toBe(bodyError);
  });
});
