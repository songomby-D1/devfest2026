import { z } from 'zod';

/** Injection token for the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

const MIN_TOKEN_LENGTH = 32;

/** Inbound callers allowed to call Content (auth contract, per-pair secrets). */
export const SERVICE_CALLERS = ['gateway', 'nft', 'lidar'] as const;
export type ServiceCaller = (typeof SERVICE_CALLERS)[number];

/**
 * Wraps the inbound service tokens so that logging or serializing the
 * configuration never prints them.
 */
export class InboundTokens {
  readonly #tokens: ReadonlyMap<ServiceCaller, string>;

  constructor(tokens: { readonly [K in ServiceCaller]?: string | undefined }) {
    this.#tokens = new Map(
      Object.entries(tokens).filter(
        (entry): entry is [ServiceCaller, string] => entry[1] !== undefined,
      ),
    );
  }

  tokenFor(caller: ServiceCaller): string | undefined {
    return this.#tokens.get(caller);
  }

  toJSON(): string {
    return '[redacted]';
  }
}

export interface AppConfig {
  readonly port: number;
  /** Runtime role connection string (D04). Never the migration role. */
  readonly databaseUrl: string;
  readonly inboundTokens: InboundTokens;
}

/** Thrown when the environment is invalid. Never contains variable values. */
export class InvalidConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid configuration:\n${problems.map((p) => `- ${p}`).join('\n')}`,
    );
    this.name = 'InvalidConfigError';
  }
}

const token = z
  .string()
  .min(
    MIN_TOKEN_LENGTH,
    `must be at least ${String(MIN_TOKEN_LENGTH)} characters`,
  );

const envSchema = z.object({
  PORT: z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be between 1 and 65535')
    .max(65_535, 'must be between 1 and 65535')
    .default(3000),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
  CONTENT_INBOUND_TOKEN_GATEWAY: token,
  CONTENT_INBOUND_TOKEN_NFT: token.optional(),
  CONTENT_INBOUND_TOKEN_LIDAR: token.optional(),
});

/**
 * Validates the environment. Empty strings count as absent, and messages name
 * the variable but never echo its value.
 */
export function loadAppConfig(raw: NodeJS.ProcessEnv): AppConfig {
  const provided = Object.fromEntries(
    Object.entries(raw).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const result = envSchema.safeParse(provided);
  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => {
        const name = issue.path.join('.');
        const reason =
          issue.code !== 'invalid_type'
            ? issue.message
            : name in provided
              ? 'has an invalid value'
              : 'is required';
        return `${name} ${reason}`;
      }),
    );
  }
  const env = result.data;
  return {
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    inboundTokens: new InboundTokens({
      gateway: env.CONTENT_INBOUND_TOKEN_GATEWAY,
      nft: env.CONTENT_INBOUND_TOKEN_NFT,
      lidar: env.CONTENT_INBOUND_TOKEN_LIDAR,
    }),
  };
}
