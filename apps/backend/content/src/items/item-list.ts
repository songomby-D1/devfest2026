import { z } from 'zod';
import { PublicError } from '../common/public-error';
import { ITEM_KINDS, type ItemPosition } from './item';

/** `ItemListScope` of the Gate 0 contract (packages/shared `content.ts`). */
export const ITEM_LIST_SCOPES = ['public', 'mine', 'review'] as const;
export type ItemListScope = (typeof ITEM_LIST_SCOPES)[number];

export const LIST_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
  q: 100,
  cursor: 200,
} as const;

/**
 * Query of `GET /internal/v1/items`, as in the gateway's `listItems`.
 * Unknown parameters are ignored; a blank `q` means no text filter.
 */
export const listItemsQuerySchema = z.object({
  scope: z
    .enum(ITEM_LIST_SCOPES, {
      error: `must be one of ${ITEM_LIST_SCOPES.join(', ')}`,
    })
    .default('public'),
  kind: z
    .enum(ITEM_KINDS, { error: `must be one of ${ITEM_KINDS.join(', ')}` })
    .optional(),
  q: z
    .string({ error: 'must be a single string' })
    .trim()
    .max(LIST_LIMITS.q, `must be at most ${String(LIST_LIMITS.q)} characters`)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  cursor: z
    .string({ error: 'must be a single string' })
    .max(LIST_LIMITS.cursor, 'is not a valid cursor')
    .optional(),
  limit: z
    .string({ error: 'must be a single integer' })
    .regex(/^\d{1,3}$/, 'must be an integer')
    .transform(Number)
    .pipe(
      z
        .number()
        .min(1, `must be between 1 and ${String(LIST_LIMITS.maxLimit)}`)
        .max(
          LIST_LIMITS.maxLimit,
          `must be between 1 and ${String(LIST_LIMITS.maxLimit)}`,
        ),
    )
    .default(LIST_LIMITS.defaultLimit),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

const cursorSchema = z.strictObject({
  s: z.enum(ITEM_LIST_SCOPES),
  t: z.iso.datetime(),
  i: z.uuid(),
});

/**
 * Opaque cursor: base64url JSON of the scope and the last item's position.
 * Clients pass it back unchanged and must not parse it.
 */
export function encodeCursor(
  scope: ItemListScope,
  position: ItemPosition,
): string {
  return Buffer.from(
    JSON.stringify({
      s: scope,
      t: position.createdAt.toISOString(),
      i: position.id,
    }),
  ).toString('base64url');
}

/** Decodes a cursor of the same scope, or throws `400 VALIDATION_FAILED`. */
export function decodeCursor(
  scope: ItemListScope,
  cursor: string,
): ItemPosition {
  const invalid = () =>
    PublicError.validation([
      { field: 'cursor', reason: 'is not a valid cursor' },
    ]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const result = cursorSchema.safeParse(parsed);
  if (!result.success || result.data.s !== scope) throw invalid();
  return { createdAt: new Date(result.data.t), id: result.data.i };
}
