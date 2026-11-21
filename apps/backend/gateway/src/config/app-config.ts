import { z } from 'zod';
import type { UpstreamName } from '@devfest2026/shared';

export const APP_CONFIG = Symbol('APP_CONFIG');

const MIN_SECRET_LENGTH = 32;
const MIB = 1024 * 1024;

const serviceUrl = z.url({ protocol: /^https?$/ });
const secret = z.string().min(MIN_SECRET_LENGTH);
const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const originList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z.array(
      z
        .url({ protocol: /^https?$/ })
        .refine(
          (origin) => new URL(origin).origin === origin,
          'must be an origin without a path or trailing slash',
        ),
    ),
  );

const appConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  AUTH_SERVICE_URL: serviceUrl,
  CONTENT_SERVICE_URL: serviceUrl,
  NFT_SERVICE_URL: serviceUrl,
  LIDAR_SERVICE_URL: serviceUrl,
  AUTH_SERVICE_TOKEN: secret,
  CONTENT_SERVICE_TOKEN: secret,
  NFT_SERVICE_TOKEN: secret,
  LIDAR_SERVICE_TOKEN: secret,
  GATEWAY_ADMIN_TOKEN: secret,
  GATEWAY_ALLOWED_ORIGINS: originList,
  SESSION_COOKIE_SECURE: booleanFlag,
  SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(30 * 24 * 3600)
    .default(7 * 24 * 3600),
  UPSTREAM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60_000)
    .default(5000),
  AUTH_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(8000),
  UPLOAD_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(15 * 60_000)
    .default(120_000),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(2048 * MIB)
    .default(100 * MIB),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(10),
});

export interface UpstreamConfig {
  readonly url: string;
  readonly token: string;
}

export interface AppConfig {
  readonly port: number;
  readonly upstreams: Readonly<Record<UpstreamName, UpstreamConfig>>;
  readonly adminToken: string;
  readonly allowedOrigins: readonly string[];
  readonly sessionCookie: {
    readonly secure: boolean;
    readonly maxAgeSeconds: number;
  };
  readonly timeouts: {
    readonly upstreamMs: number;
    readonly authMs: number;
    readonly uploadMs: number;
  };
  readonly maxUploadBytes: number;
  readonly authRateLimitPerMinute: number;
}

export class InvalidConfigError extends Error {
  constructor(readonly invalidVariables: readonly string[]) {
    super(
      `Invalid or missing environment variables: ${invalidVariables.join(', ')}`,
    );
    this.name = 'InvalidConfigError';
  }
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = appConfigSchema.safeParse(env);
  if (!result.success) {
    // Only variable names are reported: values may be secrets.
    const names = new Set(
      result.error.issues.map((issue) => String(issue.path[0])),
    );
    throw new InvalidConfigError([...names].sort());
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    upstreams: {
      auth: { url: parsed.AUTH_SERVICE_URL, token: parsed.AUTH_SERVICE_TOKEN },
      content: {
        url: parsed.CONTENT_SERVICE_URL,
        token: parsed.CONTENT_SERVICE_TOKEN,
      },
      nft: { url: parsed.NFT_SERVICE_URL, token: parsed.NFT_SERVICE_TOKEN },
      lidar: {
        url: parsed.LIDAR_SERVICE_URL,
        token: parsed.LIDAR_SERVICE_TOKEN,
      },
    },
    adminToken: parsed.GATEWAY_ADMIN_TOKEN,
    allowedOrigins: parsed.GATEWAY_ALLOWED_ORIGINS,
    sessionCookie: {
      secure: parsed.SESSION_COOKIE_SECURE,
      maxAgeSeconds: parsed.SESSION_COOKIE_MAX_AGE_SECONDS,
    },
    timeouts: {
      upstreamMs: parsed.UPSTREAM_TIMEOUT_MS,
      authMs: parsed.AUTH_TIMEOUT_MS,
      uploadMs: parsed.UPLOAD_TIMEOUT_MS,
    },
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    authRateLimitPerMinute: parsed.AUTH_RATE_LIMIT_PER_MINUTE,
  };
}
