import { InMemoryPinner } from './in-memory-pinner';
import { jsonBytes } from './pinner';

describe('InMemoryPinner', () => {
  it('stores pins under a deterministic CID and is idempotent', async () => {
    const pinner = new InMemoryPinner();
    const request = {
      name: 'lova-x-metadata.json',
      bytes: jsonBytes({ b: 1, a: 2 }),
      contentType: 'application/json',
      keyvalues: { role: 'metadata' },
    };

    const first = await pinner.pin(request);
    const second = await pinner.pin(request);

    expect(second).toEqual(first);
    expect(first.cid).toMatch(/^bafkrei[a-z2-7]{52}$/);
    expect(pinner.size).toBe(1);
    expect(new TextDecoder().decode(pinner.get(first.cid)?.bytes)).toBe(
      '{"b":1,"a":2}',
    );
  });
});
