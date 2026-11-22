import type { z } from 'zod';
import { PublicError, type ValidationIssue } from './public-error';

/** Turns zod issues into `details: [{ field, reason }]` without echoing input values. */
export function issuesOf(error: z.ZodError): ValidationIssue[] {
  return error.issues.flatMap((issue): ValidationIssue[] => {
    const path = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: path === '' ? key : `${path}.${key}`,
        reason: 'is not allowed',
      }));
    }
    if (issue.code === 'invalid_type' && path === '') {
      return [{ field: 'body', reason: 'must be a JSON object' }];
    }
    return [{ field: path === '' ? 'body' : path, reason: issue.message }];
  });
}

/** Parses a value or throws `400 VALIDATION_FAILED` with field details. */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw PublicError.validation(issuesOf(result.error));
  }
  return result.data;
}
