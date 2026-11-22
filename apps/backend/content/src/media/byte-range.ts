// Copied from the LiDAR service (apps/backend/lidar/src/assets), not imported (D14).
export type ByteRangeResult =
  | { readonly kind: 'full' }
  | { readonly kind: 'partial'; readonly start: number; readonly end: number }
  | { readonly kind: 'unsatisfiable' };

const FULL: ByteRangeResult = { kind: 'full' };
const UNSATISFIABLE: ByteRangeResult = { kind: 'unsatisfiable' };
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * Resolves a Range header against an object size (RFC 9110, section 14).
 * Only one byte range is honored: multiple ranges, other units and malformed
 * headers are ignored and the full object is served, which the RFC permits.
 */
export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRangeResult {
  const match = header === undefined ? null : SINGLE_RANGE.exec(header.trim());
  if (!match) return FULL;
  const [, first = '', last = ''] = match;
  if (first === '' && last === '') return FULL;

  if (first === '') {
    const suffixLength = toSafeInteger(last);
    if (suffixLength === null) return FULL;
    if (suffixLength === 0 || size === 0) return UNSATISFIABLE;
    return {
      kind: 'partial',
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    };
  }

  const start = toSafeInteger(first);
  if (start === null) return FULL;
  const end = last === '' ? Number.MAX_SAFE_INTEGER : toSafeInteger(last);
  // A last position before the first one makes the header invalid, so it is ignored.
  if (end === null || end < start) return FULL;
  if (start >= size) return UNSATISFIABLE;
  return { kind: 'partial', start, end: Math.min(end, size - 1) };
}

function toSafeInteger(digits: string): number | null {
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}
