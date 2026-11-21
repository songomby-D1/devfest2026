import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class ZodValidationPipe<
  Schema extends z.ZodType,
> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    throw new BadRequestException({ message: 'Validation failed', issues });
  }
}
