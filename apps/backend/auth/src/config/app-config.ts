import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const MIN_SERVICE_TOKEN_LENGTH = 32;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const appConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_INBOUND_TOKEN_GATEWAY: z.string().min(MIN_SERVICE_TOKEN_LENGTH),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).max(1440).default(120),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  PASSWORD_HASH_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  PASSWORD_HASH_MAX_WAIT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60_000)
    .default(5000),
});

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly inboundTokens: { readonly gateway: string };
  readonly session: { readonly idleMs: number; readonly absoluteMs: number };
  readonly passwordHashing: {
    readonly concurrency: number;
    readonly maxWaitMs: number;
  };
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
    databaseUrl: parsed.DATABASE_URL,
    inboundTokens: { gateway: parsed.AUTH_INBOUND_TOKEN_GATEWAY },
    session: {
      idleMs: parsed.SESSION_IDLE_MINUTES * MINUTE_MS,
      absoluteMs: parsed.SESSION_ABSOLUTE_DAYS * DAY_MS,
    },
    passwordHashing: {
      concurrency: parsed.PASSWORD_HASH_CONCURRENCY,
      maxWaitMs: parsed.PASSWORD_HASH_MAX_WAIT_MS,
    },
  };
}
