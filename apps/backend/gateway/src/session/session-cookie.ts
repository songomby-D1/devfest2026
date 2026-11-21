import type { Request } from 'express';

const DEVELOPMENT_NAME = 'lova_session';
/** `__Host-` requires Secure, Path=/ and no Domain, which pins the cookie to this host. */
const SECURE_NAME = '__Host-lova_session';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface CookieSettings {
  readonly secure: boolean;
  readonly maxAgeSeconds: number;
}

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_NAME : DEVELOPMENT_NAME;
}

export function serializeSessionCookie(
  token: string,
  settings: CookieSettings,
): string {
  return [
    `${sessionCookieName(settings.secure)}=${token}`,
    'Path=/',
    `Max-Age=${String(settings.maxAgeSeconds)}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(settings.secure ? ['Secure'] : []),
  ].join('; ');
}

export function serializeClearedCookie(secure: boolean): string {
  return [
    `${sessionCookieName(secure)}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/** Tokens that cannot be valid are never sent to Auth. */
export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
