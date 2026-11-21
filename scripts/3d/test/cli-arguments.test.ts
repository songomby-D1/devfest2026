import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { browserSettingsFrom, parseArguments } from '../src/cli-arguments.ts';
import { InvalidInputError } from '../src/errors.ts';

describe('parseArguments', () => {
  it('resolves paths against the caller directory', () => {
    assert.deepEqual(
      parseArguments(['scans/vase.usdz', 'vase', 'out'], '/work'),
      {
        usdzPath: '/work/scans/vase.usdz',
        itemId: 'vase',
        outputDirectory: '/work/out',
      },
    );
  });

  it('rejects a wrong argument count', () => {
    assert.throws(() => parseArguments(['a.usdz', 'a'], '/work'), {
      name: InvalidInputError.name,
      message: /^usage:/,
    });
  });
});

describe('browserSettingsFrom', () => {
  it('uses CHROME_PATH when set', () => {
    assert.deepEqual(browserSettingsFrom({ CHROME_PATH: '/opt/chrome' }), {
      executablePath: '/opt/chrome',
    });
  });

  it('falls back to the Playwright browser when CHROME_PATH is unset or empty', () => {
    assert.deepEqual(browserSettingsFrom({}), { executablePath: undefined });
    assert.deepEqual(browserSettingsFrom({ CHROME_PATH: '' }), {
      executablePath: undefined,
    });
  });
});
