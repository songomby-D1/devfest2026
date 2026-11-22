import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PublicError, requestIdOf } from './public-error';

/** The only MVP permission (D13). Unknown permissions are ignored. */
export const PERMISSIONS = ['reviewer'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Built by the gateway from the verified session (frozen contract). */
export interface CallerContext {
  /** Auth account ID, or `null` for a guest. */
  readonly userId: string | null;
  readonly permissions: readonly Permission[];
  readonly requestId: string;
}

/** Platform contract header, then the older Auth contract name (adapter). */
export const USER_ID_HEADERS = ['x-caller-user-id', 'x-caller-account-id'];
export const PERMISSIONS_HEADER = 'x-caller-permissions';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Reads the caller context from headers. Runs after ServiceTokenGuard, so the
 * headers come from an authenticated service. A malformed user ID is a
 * gateway fault and is rejected rather than treated as a guest.
 */
export function callerContextOf(request: Request): CallerContext {
  const rawUserId = USER_ID_HEADERS.map((name) => headerOf(request, name)).find(
    (value) => value !== undefined,
  );
  if (rawUserId !== undefined && !UUID.test(rawUserId)) {
    throw PublicError.serviceUnauthenticated();
  }
  const permissions = (headerOf(request, PERMISSIONS_HEADER) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(isPermission);
  return {
    userId: rawUserId?.toLowerCase() ?? null,
    permissions: [...new Set(permissions)],
    requestId: requestIdOf(request),
  };
}

export function isReviewer(caller: CallerContext): boolean {
  return caller.permissions.includes('reviewer');
}

/** Controller parameter decorator: `@Caller() caller: CallerContext`. */
export const Caller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CallerContext =>
    callerContextOf(context.switchToHttp().getRequest<Request>()),
);
