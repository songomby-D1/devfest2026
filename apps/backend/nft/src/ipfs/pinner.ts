/** One file to pin on IPFS. JSON documents are pinned as files too. */
export interface PinRequest {
  /** Deterministic pin name, so that a repeated pin is recognisable. */
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  /** Pinata `keyvalues`: public, non-personal labels only. */
  readonly keyvalues: Readonly<Record<string, string>>;
}

export interface PinResult {
  /** CIDv1 of the pinned bytes. */
  readonly cid: string;
}

/**
 * Pins public bytes on IPFS. Implementations must be idempotent: the same
 * bytes always give the same CID (content addressing, CIDv1).
 */
export interface Pinner {
  pin(request: PinRequest, requestId: string): Promise<PinResult>;
}

/** Nest injection token for the configured Pinner (`IPFS_DRIVER`). */
export const PINNER = Symbol('PINNER');

/** Why a pin failed. Logged, never returned to users. */
export type IpfsFailureReason =
  | 'not_configured'
  | 'timeout'
  | 'network'
  | 'unauthenticated'
  | 'rejected'
  | 'upstream_error'
  | 'invalid_response';

/** Thrown by a Pinner. Its message never contains a secret. */
export class IpfsError extends Error {
  constructor(readonly reason: IpfsFailureReason) {
    super(`IPFS pin failed: ${reason}`);
    this.name = 'IpfsError';
  }
}

/**
 * Canonical bytes of a JSON document: `JSON.stringify` keeps the insertion
 * order of keys, so a builder with a fixed key order gives identical bytes,
 * hence an identical CID, for identical input.
 */
export function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
