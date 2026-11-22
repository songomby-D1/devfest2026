import { z } from 'zod';
import { CLAIM_TARGETS, ITEM_KINDS, REVIEW_OUTCOMES } from './item';

/** Lengths of the gateway contract (CreateItemRequest). */
export const LIMITS = {
  title: 160,
  description: 8000,
  creatorName: 160,
  creatorCommunity: 160,
  technique: 160,
  origin: 160,
  period: 80,
  rightsStatement: 2000,
} as const;

const requiredText = (max: number) =>
  z
    .string({ error: 'must be a string' })
    .trim()
    .min(1, 'must not be empty')
    .max(max, `must be at most ${String(max)} characters`);

/** Optional free text: an empty or blank string is stored as `null`. */
const optionalText = (max: number) =>
  z
    .string({ error: 'must be a string or null' })
    .trim()
    .max(max, `must be at most ${String(max)} characters`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const kind = z.enum(ITEM_KINDS, {
  error: `must be one of ${ITEM_KINDS.join(', ')}`,
});

const fields = {
  title: requiredText(LIMITS.title),
  kind,
  description: requiredText(LIMITS.description),
  creatorName: optionalText(LIMITS.creatorName),
  creatorCommunity: optionalText(LIMITS.creatorCommunity),
  technique: optionalText(LIMITS.technique),
  origin: optionalText(LIMITS.origin),
  period: optionalText(LIMITS.period),
  rightsStatement: requiredText(LIMITS.rightsStatement),
  rightsConfirmed: z.boolean({ error: 'must be a boolean' }),
};

/** `POST /internal/v1/items`, identical to the gateway's CreateItemRequest. */
export const createItemSchema = z.strictObject(fields);
export type CreateItemInput = z.infer<typeof createItemSchema>;

/**
 * `PATCH /internal/v1/items/:id`: any subset of the create fields, at least
 * one. Required fields cannot be cleared; optional ones accept `null`.
 */
export const updateItemSchema = z
  .strictObject({
    title: fields.title.optional(),
    kind: fields.kind.optional(),
    description: fields.description.optional(),
    creatorName: fields.creatorName,
    creatorCommunity: fields.creatorCommunity,
    technique: fields.technique,
    origin: fields.origin,
    period: fields.period,
    rightsStatement: fields.rightsStatement.optional(),
    rightsConfirmed: fields.rightsConfirmed.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'must contain at least one field',
    // Only once the fields themselves are valid, to avoid a misleading issue.
    when: (payload) => payload.issues.length === 0,
  });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/** Length of a decision or unpublication note (gateway `DecisionRequest`). */
export const NOTE_LIMIT = 4000;

const note = z
  .string({ error: 'must be a string' })
  .trim()
  .max(NOTE_LIMIT, `must be at most ${String(NOTE_LIMIT)} characters`);

export const DECISIONS = ['publish', 'return', 'reject'] as const;
export type Decision = (typeof DECISIONS)[number];

/**
 * `POST /internal/v1/items/:id/decision`, the gateway's `DecisionRequest`.
 * `return` and `reject` also need a non-empty note: it tells the owner what
 * to fix or why the submission is closed (D18: record the rationale).
 */
export const decisionSchema = z
  .strictObject({
    decision: z.enum(DECISIONS, {
      error: `must be one of ${DECISIONS.join(', ')}`,
    }),
    note,
  })
  .refine((value) => value.decision === 'publish' || value.note !== '', {
    path: ['note'],
    message: 'must not be empty for return or reject',
    when: (payload) => payload.issues.length === 0,
  });
export type DecisionInput = z.infer<typeof decisionSchema>;

/** `POST /internal/v1/items/:id/unpublish` (Content only, see content.yaml). */
export const unpublishSchema = z.strictObject({ note });
export type UnpublishInput = z.infer<typeof unpublishSchema>;

/** Lengths of the gateway `ReviewRequest`. */
export const REVIEW_LIMITS = {
  rationale: 4000,
  evidenceItems: 20,
  evidenceText: 500,
} as const;

/**
 * `POST /internal/v1/items/:id/review`, the gateway's `ReviewRequest`. The
 * rationale is required: D18 records the reviewer and their rationale.
 * Evidence entries are free text, such as a source or an archive reference.
 */
export const reviewSchema = z.strictObject({
  target: z.enum(CLAIM_TARGETS, {
    error: `must be one of ${CLAIM_TARGETS.join(', ')}`,
  }),
  outcome: z.enum(REVIEW_OUTCOMES, {
    error: `must be one of ${REVIEW_OUTCOMES.join(', ')}`,
  }),
  rationale: requiredText(REVIEW_LIMITS.rationale),
  evidence: z
    .array(requiredText(REVIEW_LIMITS.evidenceText), {
      error: 'must be an array of strings',
    })
    .max(
      REVIEW_LIMITS.evidenceItems,
      `must have at most ${String(REVIEW_LIMITS.evidenceItems)} entries`,
    ),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
