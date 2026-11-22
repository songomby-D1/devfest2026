import { inspect } from 'node:util';
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

const REDACTED = '[redacted]';

/** Storage credentials that render as redacted when logged or serialized. */
export class StorageCredentials {
  constructor(
    readonly accessKeyId: string,
    readonly secretAccessKey: string,
  ) {}

  toJSON(): Record<string, string> {
    return { accessKeyId: REDACTED, secretAccessKey: REDACTED };
  }

  toString(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return `StorageCredentials ${REDACTED}`;
  }
}

/** Private S3-compatible bucket and prefix scoped to Content (D05). */
export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  /** Empty, or relative segments each ending with "/". */
  readonly prefix: string;
  readonly forcePathStyle: boolean;
  readonly credentials: StorageCredentials;
}

/** Upload limits proposed by the Content owner under D18. */
export interface MediaLimits {
  readonly maxImageBytes: number;
  readonly maxVideoBytes: number;
  readonly maxPerItem: number;
}

export interface AppConfig {
  readonly port: number;
  /** Runtime role connection string (D04). Never the migration role. */
  readonly databaseUrl: string;
  readonly inboundTokens: InboundTokens;
  readonly storage: StorageConfig;
  readonly media: MediaLimits;
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

const MIB = 1024 * 1024;
/** Media sizes are stored as a 32-bit integer; 1 GiB keeps a wide margin. */
const MAX_MEDIA_BYTES = 1024 * MIB;

const byteLimit = (fallback: number) =>
  z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be positive')
    .max(MAX_MEDIA_BYTES, `must be at most ${String(MAX_MEDIA_BYTES)}`)
    .default(fallback);

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
  STORAGE_ENDPOINT: z.url({
    protocol: /^https?$/,
    error: 'must be an http(s) URL',
  }),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  // S3 bucket naming rules, which SeaweedFS also applies.
  STORAGE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'must be a valid bucket name'),
  STORAGE_PREFIX: z
    .string()
    .regex(
      /^([A-Za-z0-9][A-Za-z0-9._-]*\/)*$/,
      'must be empty or relative segments each ending with "/"',
    )
    .refine(
      (prefix) => !prefix.split('/').includes('..'),
      'must not contain ".." segments',
    )
    .default('content/'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'], { error: 'must be true or false' })
    .default('true')
    .transform((value) => value === 'true'),
  // Images match the 12 MB input ceiling of the analysis spike; videos stay
  // under the gateway's 100 MiB upload default with room for the multipart
  // envelope.
  MEDIA_MAX_IMAGE_BYTES: byteLimit(12 * MIB),
  MEDIA_MAX_VIDEO_BYTES: byteLimit(50 * MIB),
  MEDIA_MAX_PER_ITEM: z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be between 1 and 50')
    .max(50, 'must be between 1 and 50')
    .default(10),
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
    storage: {
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      prefix: env.STORAGE_PREFIX,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: new StorageCredentials(
        env.STORAGE_ACCESS_KEY_ID,
        env.STORAGE_SECRET_ACCESS_KEY,
      ),
    },
    media: {
      maxImageBytes: env.MEDIA_MAX_IMAGE_BYTES,
      maxVideoBytes: env.MEDIA_MAX_VIDEO_BYTES,
      maxPerItem: env.MEDIA_MAX_PER_ITEM,
    },
  };
}
