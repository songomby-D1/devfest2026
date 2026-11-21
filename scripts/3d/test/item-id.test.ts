import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidInputError } from '../src/errors.ts';
import { parseItemId } from '../src/item-id.ts';

describe('parseItemId', () => {
  for (const valid of ['vase-ambalavao', 'chargeur', 'a1', '0-0']) {
    it(`accepts ${valid}`, () => {
      assert.equal(parseItemId(valid), valid);
    });
  }

  for (const invalid of [
    '',
    'Vase',
    'vase_1',
    'vase 1',
    '../vase',
    'vase/1',
    'vasé',
    'vase\n',
  ]) {
    it(`rejects ${JSON.stringify(invalid)}`, () => {
      assert.throws(() => parseItemId(invalid), InvalidInputError);
    });
  }
});
