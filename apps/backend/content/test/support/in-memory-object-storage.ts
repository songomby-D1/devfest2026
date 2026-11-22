import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import {
  ObjectNotFoundError,
  type ObjectRange,
  type ObjectStorage,
  type ObjectWrite,
  StorageUnavailableError,
} from '../../src/storage/object-storage';

interface MemoryObject {
  readonly data: Buffer;
  readonly contentType: string;
}

/** Object storage fake for tests: whole objects in memory, written only on success. */
export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, MemoryObject>();
  unavailable = false;
  failDeletes = false;

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
    if (this.unavailable) {
      body.destroy();
      throw new StorageUnavailableError('test');
    }
    const data = await buffer(body);
    if (data.length !== options.contentLength)
      throw new StorageUnavailableError('length');
    this.objects.set(key, { data, contentType: options.contentType });
  }

  delete(key: string): Promise<void> {
    if (this.unavailable || this.failDeletes)
      return Promise.reject(new StorageUnavailableError('test'));
    this.objects.delete(key);
    return Promise.resolve();
  }
}
