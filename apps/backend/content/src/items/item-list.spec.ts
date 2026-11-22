import { PublicError } from '../common/public-error';
import { parseOrThrow } from '../common/zod-validation';
import { decodeCursor, encodeCursor, listItemsQuerySchema } from './item-list';

const POSITION = {
  createdAt: new Date('2026-11-22T08:00:01.123Z'),
  id: '1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a',
};

function detailsOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    if (error instanceof PublicError) return error.details;
    throw error;
  }
  throw new Error('expected a PublicError');
}

describe('listItemsQuerySchema', () => {
  it('defaults to the public scope and 20 items', () => {
    expect(parseOrThrow(listItemsQuerySchema, {})).toEqual({
      scope: 'public',
      limit: 20,
    });
  });

  it('parses every parameter and ignores unknown ones', () => {
    expect(
      parseOrThrow(listItemsQuerySchema, {
        scope: 'mine',
        kind: 'textile',
        q: '  lamba ',
        cursor: 'abc',
        limit: '50',
        extra: 'x',
      }),
    ).toEqual({
      scope: 'mine',
      kind: 'textile',
      q: 'lamba',
      cursor: 'abc',
      limit: 50,
    });
  });

  it('treats a blank q as no filter', () => {
    expect(parseOrThrow(listItemsQuerySchema, { q: '   ' })).toEqual({
      scope: 'public',
      limit: 20,
    });
  });

  it.each([
    [{ scope: 'all' }, 'scope'],
    [{ kind: 'vase' }, 'kind'],
    [{ q: 'x'.repeat(101) }, 'q'],
    [{ cursor: 'x'.repeat(201) }, 'cursor'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '51' }, 'limit'],
    [{ limit: '1.5' }, 'limit'],
    [{ limit: 'ten' }, 'limit'],
    [{ kind: ['textile', 'object'] }, 'kind'],
  ])('rejects %o on %s', (query, field) => {
    expect(detailsOf(() => parseOrThrow(listItemsQuerySchema, query))).toEqual([
      { field, reason: expect.any(String) as string },
    ]);
  });
});

describe('cursor', () => {
  it('round-trips the position of its scope', () => {
    const cursor = encodeCursor('public', POSITION);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor('public', cursor)).toEqual(POSITION);
  });

  it.each([
    ['another scope', encodeCursor('mine', POSITION)],
    ['garbage', '!!!'],
    ['JSON that is not a cursor', Buffer.from('{"a":1}').toString('base64url')],
    [
      'a bad id',
      Buffer.from(
        '{"s":"public","t":"2026-11-22T08:00:00.000Z","i":"x"}',
      ).toString('base64url'),
    ],
  ])('rejects %s', (_label, cursor) => {
    expect(detailsOf(() => decodeCursor('public', cursor))).toEqual([
      { field: 'cursor', reason: 'is not a valid cursor' },
    ]);
  });
});
