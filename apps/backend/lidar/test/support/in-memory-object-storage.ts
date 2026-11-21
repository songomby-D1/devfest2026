import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import {
  ObjectNotFoundError,
  type ObjectRange,
  type ObjectStorage,
  type ObjectWrite,
  type StoredObject,
  StorageUnavailableError,
} from '../../src/storage/object-storage.js';

interface MemoryObject {
  readonly data: Buffer;
  readonly contentType: string;
}

/** Object storage fake for tests: whole objects in memory, written only on success. */
export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, MemoryObject>();
  unavailable = false;

  put(
    key: string,
    data: Buffer,
    contentType = 'application/octet-stream',
  ): void {
    this.objects.set(key, { data, contentType });
  }

  stat(key: string): Promise<StoredObject | null> {
    if (this.unavailable)
      return Promise.reject(new StorageUnavailableError('test'));
    const object = this.objects.get(key);
    return Promise.resolve(
      object
        ? { size: object.data.length, etag: `"${String(object.data.length)}"` }
        : null,
    );
  }

  read(key: string, range?: ObjectRange): Promise<Readable> {
    if (this.unavailable)
      return Promise.reject(new StorageUnavailableError('test'));
    const object = this.objects.get(key);
    if (!object) return Promise.reject(new ObjectNotFoundError());
    const data = range
      ? object.data.subarray(range.start, range.end + 1)
      : object.data;
    return Promise.resolve(Readable.from([data]));
  }

  async write(
    key: string,
    body: Readable,
    options: ObjectWrite,
  ): Promise<void> {
    if (this.unavailable) throw new StorageUnavailableError('test');
    const data = await buffer(body);
    if (data.length !== options.contentLength)
      throw new StorageUnavailableError('length');
    this.objects.set(key, { data, contentType: options.contentType });
  }
}

/** Minimal byte sequences that pass the variant signature checks. */
export function glbBytes(size: number): Buffer {
  const data = Buffer.alloc(size, 7);
  data.write('glTF', 0, 'latin1');
  return data;
}

export function webpBytes(size: number): Buffer {
  const data = Buffer.alloc(size, 7);
  data.write('RIFF', 0, 'latin1');
  data.write('WEBP', 8, 'latin1');
  return data;
}

export function usdzBytes(size: number): Buffer {
  const data = Buffer.alloc(size, 7);
  data.writeUInt32BE(0x504b0304, 0);
  return data;
}
