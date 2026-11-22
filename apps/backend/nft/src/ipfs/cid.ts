import { createHash } from 'node:crypto';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function digit(index: number): string {
  return BASE32_ALPHABET.charAt(index & 31);
}

/** RFC 4648 base32, lowercase, without padding (multibase `b`). */
export function base32(bytes: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += digit(buffer >>> (bits - 5));
      bits -= 5;
    }
  }
  if (bits > 0) output += digit(buffer << (5 - bits));
  return output;
}

/** CIDv1 header for the `raw` codec (0x55) and a sha2-256 multihash. */
const RAW_SHA256_PREFIX = Uint8Array.of(0x01, 0x55, 0x12, 0x20);

/**
 * CIDv1 (`raw` codec, sha2-256, base32) of bytes stored as one block. It is
 * the real CID of a single-block raw file, but Pinata chunks files into a
 * UnixFS DAG, so it only matches Pinata's CID for small raw pins. The
 * in-memory pinner uses it as a deterministic stand-in.
 */
export function rawCidV1(bytes: Uint8Array): string {
  const digest = createHash('sha256').update(bytes).digest();
  const cid = new Uint8Array(RAW_SHA256_PREFIX.length + digest.length);
  cid.set(RAW_SHA256_PREFIX, 0);
  cid.set(digest, RAW_SHA256_PREFIX.length);
  return `b${base32(cid)}`;
}
