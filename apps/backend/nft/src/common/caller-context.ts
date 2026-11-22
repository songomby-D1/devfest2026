import {
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { PublicError, REQUEST_ID_HEADER, safeRequestId } from './public-error';

/** Built by the gateway from the verified session (frozen contract). */
export interface CallerContext {
  /** Auth account ID (lowercase UUID), or `null` for a guest. */
  readonly userId: string | null;
  /** Raw permissions, relayed unchanged to Content. */
  readonly permissions: readonly string[];
  readonly requestId: string;
}

/** Platform contract header, then the older Auth contract name (adapter). */
export const USER_ID_HEADERS = ['x-caller-user-id', 'x-caller-account-id'];
export const PERMISSIONS_HEADER = 'x-caller-permissions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERMISSION = /^[a-z][a-z0-9_-]{0,63}$/;

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Reads the caller context. Runs after ServiceTokenGuard, so the headers
 * come from the gateway. A malformed user ID is a gateway fault and is
 * rejected rather than treated as a guest (same rule as Content).
 */
export function callerContextOf(request: Request): CallerContext {
  const requestId = safeRequestId(headerOf(request, REQUEST_ID_HEADER));
  const rawUserId = USER_ID_HEADERS.map((name) => headerOf(request, name)).find(
    (value) => value !== undefined,
  );
  if (rawUserId !== undefined && !UUID.test(rawUserId)) {
    throw new PublicError(
      'SERVICE_UNAUTHENTICATED',
      'The calling service is not authenticated',
      HttpStatus.UNAUTHORIZED,
      requestId,
    );
  }
  const permissions = (headerOf(request, PERMISSIONS_HEADER) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => PERMISSION.test(value));
  return {
    userId: rawUserId?.toLowerCase() ?? null,
    permissions: [...new Set(permissions)],
    requestId,
  };
}

/** Controller parameter decorator: `@Caller() caller: CallerContext`. */
export const Caller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CallerContext =>
    callerContextOf(context.switchToHttp().getRequest<Request>()),
);
