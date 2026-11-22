import { inspect } from 'node:util';
import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const MIN_ADMIN_TOKEN_LENGTH = 32;

const appConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CONTENT_SERVICE_URL: z.url({ protocol: /^https?$/ }),
  PUBLIC_ASSET_BASE_PATH: z
    .string()
    .regex(
      /^(\/[A-Za-z0-9._~-]+)+$/,
      'must be an absolute path without a trailing slash',
    )
    .refine(
      (path) => !path.split('/').includes('..'),
      'must not contain ".." segments',
    ),
  LIDAR_ADMIN_TOKEN: z.string().min(MIN_ADMIN_TOKEN_LENGTH),
  STORAGE_ENDPOINT: z.url({ protocol: /^https?$/ }),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  // S3 bucket naming rules, which SeaweedFS also applies.
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
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
    .default(''),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

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

export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  /** Empty, or relative segments each ending with "/". Scopes LiDAR objects in the bucket. */
  readonly prefix: string;
  readonly forcePathStyle: boolean;
  readonly credentials: StorageCredentials;
}

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly contentServiceUrl: string;
  readonly publicAssetBasePath: string;
  readonly adminToken: string;
  readonly storage: StorageConfig;
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
    contentServiceUrl: parsed.CONTENT_SERVICE_URL,
    publicAssetBasePath: parsed.PUBLIC_ASSET_BASE_PATH,
    adminToken: parsed.LIDAR_ADMIN_TOKEN,
    storage: {
      endpoint: parsed.STORAGE_ENDPOINT,
      region: parsed.STORAGE_REGION,
      bucket: parsed.STORAGE_BUCKET,
      prefix: parsed.STORAGE_PREFIX,
      forcePathStyle: parsed.STORAGE_FORCE_PATH_STYLE,
      credentials: new StorageCredentials(
        parsed.STORAGE_ACCESS_KEY_ID,
        parsed.STORAGE_SECRET_ACCESS_KEY,
      ),
    },
  };
}
