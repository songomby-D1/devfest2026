import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';

// Interim service token until the gateway authentication (D07) protects admin routes.
export const ADMIN_TOKEN_HEADER = 'x-lidar-admin-token';

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
    // Comparing fixed-length digests keeps the comparison constant-time regardless of input length.
    if (
      typeof provided !== 'string' ||
      !timingSafeEqual(digest(provided), this.expectedDigest)
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
