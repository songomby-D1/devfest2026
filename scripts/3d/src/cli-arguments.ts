import { resolve } from 'node:path';
import { InvalidInputError } from './errors.ts';
import type { BrowserSettings } from './isolated-page.ts';
import { parseItemId } from './item-id.ts';
import type { PreparationRequest } from './prepare-asset.ts';

export const USAGE =
  'usage: npm run prepare-asset -- <input.usdz> <item-id> <out-dir>';

export function parseArguments(
  argv: readonly string[],
  workingDirectory: string,
): PreparationRequest {
  const [usdzPath, itemId, outputDirectory] = argv;
  if (
    argv.length !== 3 ||
    usdzPath === undefined ||
    itemId === undefined ||
    outputDirectory === undefined
  ) {
    throw new InvalidInputError(USAGE);
  }
  return {
    usdzPath: resolve(workingDirectory, usdzPath),
    itemId: parseItemId(itemId),
    outputDirectory: resolve(workingDirectory, outputDirectory),
  };
}

export function browserSettingsFrom(
  environment: Readonly<Record<string, string | undefined>>,
): BrowserSettings {
  const chromePath = environment['CHROME_PATH'];
  return {
    executablePath:
      chromePath === undefined || chromePath === '' ? undefined : chromePath,
  };
}
