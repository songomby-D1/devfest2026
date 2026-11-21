import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  GatewayError,
  requestIdOf,
  sendPublicError,
} from '../common/public-error.js';
import { readCookie } from '../session/session-cookie.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function forbiddenOrigin(): GatewayError {
  return new GatewayError(
    403,
    'FORBIDDEN_ORIGIN',
    'This request comes from an origin that is not allowed.',
  );
}

function originOf(request: Request): string | undefined {
  const origin = request.headers.origin;
  if (typeof origin === 'string') return origin;
  const referer = request.headers.referer;
  if (typeof referer !== 'string') return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return 'invalid';
  }
}

/**
 * CSRF safeguard for state-changing requests, on top of SameSite=Lax (D07, platform contract).
 * A browser request must come from an allowed origin. A request without Origin or Referer is
 * accepted only when it carries no session cookie, as non-browser clients do.
 */
export function originCheck(
  allowedOrigins: readonly string[],
  sessionCookieName: string,
): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }
    const origin = originOf(request);
    const permitted =
      origin === undefined
        ? readCookie(request, sessionCookieName) === undefined
        : allowed.has(origin);
    if (permitted) {
      next();
      return;
    }
    sendPublicError(response, forbiddenOrigin(), requestIdOf(request));
  };
}
