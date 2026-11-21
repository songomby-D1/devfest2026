import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { type FieldIssue, ValidationFailedError } from '../domain/errors.js';

export class ZodValidationPipe<
  Schema extends z.ZodType,
> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationFailedError(toFieldIssues(result.error.issues));
  }
}

export function toFieldIssues(
  issues: readonly z.core.$ZodIssue[],
): FieldIssue[] {
  return issues.flatMap((issue): FieldIssue[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, reason: 'unknown_field' }));
    }
    const field = issue.path.map(String).join('.');
    return [{ field: field === '' ? 'body' : field, reason: issue.code }];
  });
}
