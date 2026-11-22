import { describe, expect, it } from 'vitest';
import { parseByteRange } from './byte-range.js';

const SIZE = 1000;

describe('parseByteRange', () => {
  it.each([
    ['bytes=0-99', 0, 99],
    ['bytes=900-', 900, 999],
    ['bytes=-100', 900, 999],
    ['bytes=-5000', 0, 999],
    ['bytes=500-5000', 500, 999],
    ['bytes=999-999', 999, 999],
    [' bytes=1-2 ', 1, 2],
  ])('resolves %s', (header, start, end) => {
    expect(parseByteRange(header, SIZE)).toEqual({
      kind: 'partial',
      start,
      end,
    });
  });

  it.each(['bytes=1000-', 'bytes=1000-2000', 'bytes=-0'])(
    'reports %s as unsatisfiable',
    (header) => {
      expect(parseByteRange(header, SIZE)).toEqual({ kind: 'unsatisfiable' });
    },
  );

  it.each([
    undefined,
    '',
    'bytes=-',
    'bytes=10-5',
    'bytes=0-1,5-6',
    'items=0-10',
    'bytes=abc-',
    'bytes=99999999999999999999-',
  ])('serves the full object for %s', (header) => {
    expect(parseByteRange(header, SIZE)).toEqual({ kind: 'full' });
  });

  it('cannot satisfy a suffix range on an empty object', () => {
    expect(parseByteRange('bytes=-10', 0)).toEqual({ kind: 'unsatisfiable' });
  });
});
