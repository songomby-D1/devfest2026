import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GatewayError } from '../common/public-error.js';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

/** Protects operator routes, which have no user interface in the MVP. */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.expectedDigest = digest(config.adminToken);
  }

  canActivate(context: ExecutionContext): boolean {
    const provided = context.switchToHttp().getRequest<Request>().headers[
      ADMIN_TOKEN_HEADER
    ];
    // Fixed-length digests keep the comparison constant-time for any input length.
    if (
      typeof provided !== 'string' ||
      !timingSafeEqual(digest(provided), this.expectedDigest)
    ) {
      throw new GatewayError(
        401,
        'UNAUTHENTICATED',
        'A valid operator token is required.',
      );
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
