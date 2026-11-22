import type { ExecutionContext } from '@nestjs/common';
import { type AppConfig, InboundTokens } from '../config/app-config';
import type { PublicError } from './public-error';
import { ServiceTokenGuard } from './service-token.guard';

const GATEWAY_TOKEN = 'g'.repeat(40);

function contextWith(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard', () => {
  const guard = new ServiceTokenGuard({
    port: 0,
    databaseUrl: 'postgresql://unused',
    inboundTokens: new InboundTokens({ gateway: GATEWAY_TOKEN }),
  } as AppConfig);

  it('accepts the gateway with its own token', () => {
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
    ['a missing token', { 'x-service-name': 'gateway' }],
    [
      'a wrong token',
      { 'x-service-name': 'gateway', 'x-service-token': 'x'.repeat(40) },
    ],
    ['a missing service name', { 'x-service-token': GATEWAY_TOKEN }],
    [
      'an unknown service',
      { 'x-service-name': 'auth', 'x-service-token': GATEWAY_TOKEN },
    ],
    [
      'a caller without a configured secret',
      { 'x-service-name': 'lidar', 'x-service-token': GATEWAY_TOKEN },
    ],
  ])('refuses %s with SERVICE_UNAUTHENTICATED', (_case, headers) => {
    expect(() => guard.canActivate(contextWith(headers))).toThrow(
      expect.objectContaining({
        code: 'SERVICE_UNAUTHENTICATED',
      }) as PublicError,
    );
  });
});
