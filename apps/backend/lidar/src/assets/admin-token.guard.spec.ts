import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import { ADMIN_TOKEN_HEADER, AdminTokenGuard } from './admin-token.guard.js';

const ADMIN_TOKEN = 'test-admin-token-with-32-characters!';

const guard = new AdminTokenGuard({ adminToken: ADMIN_TOKEN } as AppConfig);

function contextWithHeaders(
  headers: Record<string, string | string[]>,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AdminTokenGuard', () => {
  it('allows the configured token', () => {
    expect(
      guard.canActivate(
        contextWithHeaders({ [ADMIN_TOKEN_HEADER]: ADMIN_TOKEN }),
      ),
    ).toBe(true);
  });

  it.each([
    ['a missing header', {}],
    ['a wrong token', { [ADMIN_TOKEN_HEADER]: 'wrong' }],
    ['a token prefix', { [ADMIN_TOKEN_HEADER]: ADMIN_TOKEN.slice(0, -1) }],
    ['a repeated header', { [ADMIN_TOKEN_HEADER]: [ADMIN_TOKEN, ADMIN_TOKEN] }],
  ])('rejects %s', (_case, headers: Record<string, string | string[]>) => {
    expect(() => guard.canActivate(contextWithHeaders(headers))).toThrow(
      UnauthorizedException,
    );
  });
});
