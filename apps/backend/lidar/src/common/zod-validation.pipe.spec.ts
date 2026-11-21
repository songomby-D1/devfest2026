import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const pipe = new ZodValidationPipe(
  z.object({ size: z.number().int().positive() }),
);

describe('ZodValidationPipe', () => {
  it('returns the parsed value', () => {
    expect(pipe.transform({ size: 3 })).toEqual({ size: 3 });
  });

  it('reports issues by path without echoing the input', () => {
    try {
      pipe.transform({ size: 'leaked-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({
        message: 'Validation failed',
        issues: [{ path: 'size' }],
      });
      expect(JSON.stringify(response)).not.toContain('leaked-value');
    }
  });
});
