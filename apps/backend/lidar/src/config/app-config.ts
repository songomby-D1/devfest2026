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
});

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly contentServiceUrl: string;
  readonly publicAssetBasePath: string;
  readonly adminToken: string;
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
  };
}
