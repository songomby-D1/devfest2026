import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadAppConfig } from './config/app-config.js';
import { toModel3dDescriptor } from './proxy/model3d.js';
import { FixedWindowRateLimiter } from './security/rate-limiter.js';
import {
  isWellFormedToken,
  serializeClearedCookie,
  serializeSessionCookie,
  sessionCookieName,
} from './session/session-cookie.js';

const CONTENT_ID = '3b1f6c8e-2a4d-4e8f-9b7c-1d2e3f4a5b6c';

describe('FixedWindowRateLimiter', () => {
  it('allows the limit per window and reports when to retry', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);
    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(true);
    now = 15_000;
    expect(limiter.consume('a')).toEqual({
      allowed: false,
      retryAfterSeconds: 45,
    });
    expect(limiter.consume('b').allowed).toBe(true);
    now = 60_000;
    expect(limiter.consume('a').allowed).toBe(true);
  });
});

describe('session cookie', () => {
  it('uses the __Host- prefix and Secure only over HTTPS', () => {
    expect(sessionCookieName(false)).toBe('lova_session');
    expect(sessionCookieName(true)).toBe('__Host-lova_session');
    const token = 't'.repeat(43);
    expect(
      serializeSessionCookie(token, { secure: true, maxAgeSeconds: 60 }),
    ).toBe(
      `__Host-lova_session=${token}; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure`,
    );
    expect(serializeClearedCookie(false)).toBe(
      'lova_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    );
  });

  it('only sends well-formed tokens to Auth', () => {
    expect(isWellFormedToken('a'.repeat(43))).toBe(true);
    expect(isWellFormedToken('a'.repeat(42))).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)};`)).toBe(false);
  });
});

describe('toModel3dDescriptor', () => {
  it('maps pending assets to processing', () => {
    expect(
      toModel3dDescriptor(CONTENT_ID, {
        contentId: CONTENT_ID,
        status: 'pending',
      }),
    ).toEqual({
      contentId: CONTENT_ID,
      status: 'processing',
      variants: null,
    });
  });

  it('rejects malformed answers', () => {
    expect(toModel3dDescriptor(CONTENT_ID, { status: 'ready' })).toBeNull();
    expect(toModel3dDescriptor(CONTENT_ID, 'ready')).toBeNull();
  });
});

describe('loadAppConfig', () => {
  const secret = 's'.repeat(32);
  const valid = {
    AUTH_SERVICE_URL: 'http://auth:3000',
    CONTENT_SERVICE_URL: 'http://content:3000',
    NFT_SERVICE_URL: 'http://nft-service:3005',
    LIDAR_SERVICE_URL: 'http://lidar:3000',
    AUTH_SERVICE_TOKEN: secret,
    CONTENT_SERVICE_TOKEN: secret,
    NFT_SERVICE_TOKEN: secret,
    LIDAR_SERVICE_TOKEN: secret,
    GATEWAY_ADMIN_TOKEN: secret,
  };

  it('parses origins and defaults', () => {
    const config = loadAppConfig({
      ...valid,
      GATEWAY_ALLOWED_ORIGINS:
        'http://localhost:5173, http://192.168.1.20:5173',
    });
    expect(config.allowedOrigins).toEqual([
      'http://localhost:5173',
      'http://192.168.1.20:5173',
    ]);
    expect(config.sessionCookie).toEqual({
      secure: false,
      maxAgeSeconds: 604_800,
    });
    expect(config.authRateLimitPerMinute).toBe(10);
  });

  it('rejects origins with a path and names the variable only', () => {
    expect(() =>
      loadAppConfig({
        ...valid,
        GATEWAY_ALLOWED_ORIGINS: 'http://localhost:5173/app',
      }),
    ).toThrow(InvalidConfigError);
    try {
      loadAppConfig({ ...valid, GATEWAY_ADMIN_TOKEN: 'leaked-short' });
    } catch (error) {
      expect((error as Error).message).toBe(
        'Invalid or missing environment variables: GATEWAY_ADMIN_TOKEN',
      );
    }
  });
});
