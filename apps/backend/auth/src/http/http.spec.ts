import type { ExecutionContext } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import {
  EmailAlreadyRegisteredError,
  ValidationFailedError,
} from '../domain/errors.js';
import { PublicHttpError, toErrorResponse } from './error-response.js';
import { ServiceTokenGuard } from './service-token.guard.js';

const GATEWAY_TOKEN = 'gateway-to-auth-token-0123456789abcdef';

function contextWith(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard (CA12)', () => {
  const guard = new ServiceTokenGuard({
    inboundTokens: { gateway: GATEWAY_TOKEN },
  } as AppConfig);

  it('accepts the gateway with its token', () => {
    expect(
      guard.canActivate(
        contextWith({
          'x-service-name': 'gateway',
          'x-service-token': GATEWAY_TOKEN,
        }),
      ),
    ).toBe(true);
  });

  it.each([
    [{}],
    [{ 'x-service-name': 'gateway' }],
    [{ 'x-service-name': 'gateway', 'x-service-token': 'wrong' }],
    [{ 'x-service-name': 'nft', 'x-service-token': GATEWAY_TOKEN }],
    [{ 'x-service-token': GATEWAY_TOKEN }],
  ])('refuses %j', (headers) => {
    expect(() => guard.canActivate(contextWith(headers))).toThrow(
      PublicHttpError,
    );
  });
});

describe('toErrorResponse (CA15)', () => {
  it('uses the contract shape with details for validation failures', () => {
    const { status, body } = toErrorResponse(
      new ValidationFailedError([{ field: 'email', reason: 'invalid' }]),
      'req-1',
    );
    expect(status).toBe(400);
    expect(body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      requestId: 'req-1',
      details: [{ field: 'email', reason: 'invalid' }],
    });
  });

  it('maps conflicts to 409', () => {
    const { status, body } = toErrorResponse(
      new EmailAlreadyRegisteredError(),
      'req-2',
    );
    expect(status).toBe(409);
    expect(body.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('maps oversized and malformed bodies to validation failures', () => {
    expect(
      toErrorResponse({ status: 413, type: 'entity.too.large' }, 'r').status,
    ).toBe(400);
    expect(
      toErrorResponse({ status: 400, type: 'entity.parse.failed' }, 'r').body
        .code,
    ).toBe('VALIDATION_FAILED');
  });

  it('maps unknown routes to NOT_FOUND', () => {
    expect(toErrorResponse(new NotFoundException(), 'r')).toMatchObject({
      status: 404,
      body: { code: 'NOT_FOUND' },
    });
  });

  it('hides unexpected errors and their messages', () => {
    const { status, body } = toErrorResponse(
      new Error('duplicate key ana@example.org token=abc'),
      'req-3',
    );
    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: 'req-3',
    });
    expect(JSON.stringify(body)).not.toContain('ana@example.org');
  });
});
