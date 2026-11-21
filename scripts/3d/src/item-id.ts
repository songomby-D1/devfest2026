import { InvalidInputError } from './errors.ts';

const ITEM_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseItemId(value: string): string {
  if (!ITEM_ID_PATTERN.test(value)) {
    throw new InvalidInputError(
      `Invalid item id "${value}": use lowercase letters, digits and hyphens only.`,
    );
  }
  return value;
}
