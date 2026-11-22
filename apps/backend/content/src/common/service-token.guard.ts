import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  APP_CONFIG,
  type AppConfig,
  SERVICE_CALLERS,
  type ServiceCaller,
} from '../config/app-config';
import { PublicError } from './public-error';

export const SERVICE_NAME_HEADER = 'x-service-name';
export const SERVICE_TOKEN_HEADER = 'x-service-token';

function isServiceCaller(value: unknown): value is ServiceCaller {
  return (
    typeof value === 'string' &&
    (SERVICE_CALLERS as readonly string[]).includes(value)
  );
}

/** Compares digests so that the comparison time does not depend on length. */
function sameSecret(provided: string, expected: string): boolean {
  const digest = (value: string): Buffer =>
    createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/**
 * Authenticates the (x-service-name, x-service-token) pair against the
 * per-caller inbound secret. A caller without a configured secret is refused.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const name = request.headers[SERVICE_NAME_HEADER];
    const provided = request.headers[SERVICE_TOKEN_HEADER];
    if (!isServiceCaller(name) || typeof provided !== 'string') {
      throw PublicError.serviceUnauthenticated();
    }
    const expected = this.config.inboundTokens.tokenFor(name);
    if (expected === undefined || !sameSecret(provided, expected)) {
      throw PublicError.serviceUnauthenticated();
    }
    return true;
  }
}
