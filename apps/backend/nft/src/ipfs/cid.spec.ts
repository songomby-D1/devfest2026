import { base32, rawCidV1 } from './cid';

describe('base32', () => {
  it.each([
    ['', ''],
    ['f', 'my'],
    ['fo', 'mzxq'],
    ['foo', 'mzxw6'],
    ['foobar', 'mzxw6ytboi'],
  ])('encodes %p as RFC 4648 lowercase without padding', (input, output) => {
    expect(base32(new TextEncoder().encode(input))).toBe(output);
  });
});

describe('rawCidV1', () => {
  it('gives the real CIDv1 of a raw block', () => {
    // `ipfs add --cid-version=1 --raw-leaves` of the 5 bytes "hello".
    expect(rawCidV1(new TextEncoder().encode('hello'))).toBe(
      'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq',
    );
  });

  it('is deterministic and content-addressed', () => {
    const a = rawCidV1(Uint8Array.of(1, 2, 3));
    expect(rawCidV1(Uint8Array.of(1, 2, 3))).toBe(a);
    expect(rawCidV1(Uint8Array.of(1, 2, 4))).not.toBe(a);
  });
});
