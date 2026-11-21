import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { PublicHttpError } from './error-response.js';

export const SERVICE_NAME_HEADER = 'x-service-name';
export const SERVICE_TOKEN_HEADER = 'x-service-token';

/** Authenticates the (caller, token) pair. Only the gateway may call Auth (platform contract). */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly expectedDigests: ReadonlyMap<string, Buffer>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.expectedDigests = new Map([
      ['gateway', digest(config.inboundTokens.gateway)],
    ]);
  }

  canActivate(context: ExecutionContext): boolean {
    const { headers } = context.switchToHttp().getRequest<Request>();
    const caller = headers[SERVICE_NAME_HEADER];
    const token = headers[SERVICE_TOKEN_HEADER];
    const expected =
      typeof caller === 'string' ? this.expectedDigests.get(caller) : undefined;
    // Comparing fixed-length digests keeps the comparison constant-time for any input length.
    if (
      expected === undefined ||
      typeof token !== 'string' ||
      !timingSafeEqual(digest(token), expected)
    ) {
      throw new PublicHttpError(
        401,
        'SERVICE_UNAUTHENTICATED',
        'The calling service is not authenticated.',
      );
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
