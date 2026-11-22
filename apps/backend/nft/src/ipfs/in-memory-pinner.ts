import { rawCidV1 } from './cid';
import type { Pinner, PinRequest, PinResult } from './pinner';

export interface StoredPin {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly keyvalues: Readonly<Record<string, string>>;
}

/**
 * `IPFS_DRIVER=fake`: keeps pins in memory and derives deterministic CIDs
 * from the bytes. Nothing leaves the process. Forbidden in production by
 * the configuration schema.
 */
export class InMemoryPinner implements Pinner {
  private readonly pins = new Map<string, StoredPin>();

  pin(request: PinRequest): Promise<PinResult> {
    const cid = rawCidV1(request.bytes);
    this.pins.set(cid, {
      name: request.name,
      bytes: Uint8Array.from(request.bytes),
      contentType: request.contentType,
      keyvalues: { ...request.keyvalues },
    });
    return Promise.resolve({ cid });
  }

  get(cid: string): StoredPin | undefined {
    return this.pins.get(cid);
  }

  get size(): number {
    return this.pins.size;
  }
}
