import { PublicError } from '../common/public-error';
import { parseOrThrow } from '../common/zod-validation';
import { createItemSchema, updateItemSchema } from './item-schemas';

const valid = {
  title: '  Lamba mena  ',
  kind: 'textile',
  description: 'A silk burial shroud.',
  rightsStatement: 'Owned by the contributor.',
  rightsConfirmed: true,
};

function detailsOf(
  schema: typeof createItemSchema | typeof updateItemSchema,
  body: unknown,
) {
  try {
    parseOrThrow(schema, body);
  } catch (error) {
    if (error instanceof PublicError) return error.details;
    throw error;
  }
  throw new Error('Expected a validation error');
}

describe('createItemSchema', () => {
  it('trims text and defaults optional fields', () => {
    const parsed = parseOrThrow(createItemSchema, {
      ...valid,
      creatorName: '  ',
    });

    expect(parsed.title).toBe('Lamba mena');
    expect(parsed.creatorName).toBeNull();
    expect(parsed.origin).toBeUndefined();
  });

  it('names every invalid field', () => {
    const details = detailsOf(createItemSchema, {
      ...valid,
      title: ' ',
      kind: 'vase',
      period: 'x'.repeat(81),
      rightsConfirmed: 'yes',
    });

    expect(details?.map((d) => d.field).sort()).toEqual([
      'kind',
      'period',
      'rightsConfirmed',
      'title',
    ]);
  });

  it('requires the description and rights fields', () => {
    const { description: _d, rightsStatement: _r, ...rest } = valid;

    expect(
      detailsOf(createItemSchema, rest)
        ?.map((d) => d.field)
        .sort(),
    ).toEqual(['description', 'rightsStatement']);
  });

  it('rejects unknown fields such as statuses set by the client', () => {
    expect(
      detailsOf(createItemSchema, { ...valid, publicationStatus: 'published' }),
    ).toEqual([{ field: 'publicationStatus', reason: 'is not allowed' }]);
  });

  it('rejects a body that is not an object', () => {
    expect(detailsOf(createItemSchema, undefined)).toEqual([
      { field: 'body', reason: 'must be a JSON object' },
    ]);
  });
});

describe('updateItemSchema', () => {
  it('accepts a partial body and null for optional fields', () => {
    expect(parseOrThrow(updateItemSchema, { origin: null })).toEqual({
      origin: null,
    });
  });

  it('rejects an empty body', () => {
    expect(detailsOf(updateItemSchema, {})).toEqual([
      { field: 'body', reason: 'must contain at least one field' },
    ]);
  });

  it('does not allow clearing a required field', () => {
    expect(detailsOf(updateItemSchema, { title: null })?.[0]?.field).toBe(
      'title',
    );
  });
});
