import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PublicError } from '../common/public-error.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';

const CALLER_USER_ID = /^[A-Za-z0-9-]{1,128}$/;

/**
 * Generation spends paid Meshy credits, so its routes accept only the gateway
 * (`x-service-name: gateway` with its service token) and a signed-in caller.
 */
@Injectable()
export class GatewayServiceGuard implements CanActivate {
  private readonly expectedDigest: Buffer | null;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.expectedDigest =
      config.generation === null
        ? null
        : digest(config.generation.gatewayToken.value);
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.expectedDigest === null) {
      throw new PublicError(
        'GENERATION_DISABLED',
        '3D generation is not configured on this server.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const { headers } = context.switchToHttp().getRequest<Request>();
    const token = headers['x-service-token'];
    if (
      headers['x-service-name'] !== 'gateway' ||
      typeof token !== 'string' ||
      !timingSafeEqual(digest(token), this.expectedDigest)
    ) {
      throw new PublicError(
        'SERVICE_UNAUTHENTICATED',
        'The calling service is not authenticated.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return true;
  }
}

/** The signed-in visitor the gateway relays, or a 401. */
export function callerOf(request: Request): string {
  const userId = request.headers['x-caller-user-id'];
  if (typeof userId !== 'string' || !CALLER_USER_ID.test(userId)) {
    throw new PublicError(
      'UNAUTHENTICATED',
      'Sign in to generate 3D models.',
      HttpStatus.UNAUTHORIZED,
    );
  }
  return userId;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
