import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { PublicError, REQUEST_ID_HEADER, safeRequestId } from './public-error';

export const INBOUND_SERVICE_NAME_HEADER = 'x-service-name';
export const INBOUND_SERVICE_TOKEN_HEADER = 'x-service-token';

/** Only the gateway calls the NFT internal routes (platform contract). */
export const GATEWAY_SERVICE_NAME = 'gateway';

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

/** Compares digests so that the comparison time does not depend on length. */
function sameSecret(provided: string, expected: string): boolean {
  const digest = (value: string): Buffer =>
    createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export function serviceUnauthenticated(request: Request): PublicError {
  return new PublicError(
    'SERVICE_UNAUTHENTICATED',
    'The calling service is not authenticated',
    HttpStatus.UNAUTHORIZED,
    safeRequestId(headerOf(request, REQUEST_ID_HEADER)),
  );
}

/**
 * Authenticates the (`x-service-name`, `x-service-token`) pair: only
 * `gateway` with `NFT_INBOUND_TOKEN_GATEWAY`. Without a configured secret
 * every call is refused. The caller headers are trusted only after it.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const name = headerOf(request, INBOUND_SERVICE_NAME_HEADER);
    const provided = headerOf(request, INBOUND_SERVICE_TOKEN_HEADER);
    const expected = this.config.gatewayInboundToken;
    if (
      name !== GATEWAY_SERVICE_NAME ||
      provided === undefined ||
      expected === undefined ||
      expected === '' ||
      !sameSecret(provided, expected)
    ) {
      throw serviceUnauthenticated(request);
    }
    return true;
  }
}
