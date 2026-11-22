import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { SERVICE_CALLERS, type ServiceCaller } from '../config/app-config';
import { PublicError } from './public-error';
import { SERVICE_NAME_HEADER } from './service-token.guard';

/**
 * Reads the calling service name. Runs after ServiceTokenGuard, which has
 * already matched the name with its per-caller secret.
 */
export function callingServiceOf(request: Request): ServiceCaller {
  const name = request.headers[SERVICE_NAME_HEADER];
  const caller = SERVICE_CALLERS.find((known) => known === name);
  if (caller === undefined) throw PublicError.serviceUnauthenticated();
  return caller;
}

/** Controller parameter decorator: `@CallingService() service: ServiceCaller`. */
export const CallingService = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ServiceCaller =>
    callingServiceOf(context.switchToHttp().getRequest<Request>()),
);
