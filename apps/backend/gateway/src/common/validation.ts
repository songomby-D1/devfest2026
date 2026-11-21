import type { PipeTransform } from '@nestjs/common';
import type { ValidationIssue } from '@devfest2026/shared';
import { z } from 'zod';
import { validationError } from './public-error.js';

export function toValidationIssues(
  issues: readonly z.core.$ZodIssue[],
): ValidationIssue[] {
  return issues.flatMap((issue): ValidationIssue[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, reason: 'unknown_field' }));
    }
    const field = issue.path.map(String).join('.');
    return [{ field: field === '' ? 'body' : field, reason: issue.code }];
  });
}

export class ZodValidationPipe<
  Schema extends z.ZodType,
> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(
    private readonly schema: Schema,
    private readonly field?: string,
  ) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issues = toValidationIssues(result.error.issues);
    throw validationError(
      this.field === undefined
        ? issues
        : issues.map((issue) => ({
            ...issue,
            field: this.field ?? issue.field,
          })),
    );
  }
}

const uuid = z.uuid();

/** Validates an item or media ID before any upstream call. */
export function uuidParam(field: string): ZodValidationPipe<typeof uuid> {
  return new ZodValidationPipe(uuid, field);
}
