import { existsSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEthereumAddress,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';
import type { ValidationError } from 'class-validator';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const IPFS_DRIVERS = ['pinata', 'fake'] as const;
export type IpfsDriver = (typeof IPFS_DRIVERS)[number];

export const FAULT_POINTS = [
  'after-tx-send',
  'before-publish',
  'exit-during-processing',
] as const;
export type FaultPoint = (typeof FAULT_POINTS)[number];

const URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** Service tokens carry at least 32 random bytes (auth-contract.md). */
export const MIN_SERVICE_TOKEN_LENGTH = 32;

/** Accepts only the literal strings "true" and "false". */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * Environment variables of the NFT service (nft_context.md §9.8).
 * Redis variables join this schema with the queue (lot L6).
 */
export class EnvSchema {
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeEnv = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3005;

  @IsString()
  MEDIA_ROOT = '/data/media';

  @IsUrl(URL_OPTIONS)
  CHAIN_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  CHAIN_ID = 43_113;

  @IsEthereumAddress()
  CONTRACT_ADDRESS!: string;

  @Matches(PRIVATE_KEY_PATTERN, {
    message:
      'MINTER_PRIVATE_KEY must be 32 bytes of hexadecimal prefixed with 0x',
  })
  MINTER_PRIVATE_KEY!: string;

  @IsUrl(URL_OPTIONS)
  EXPLORER_BASE_URL = 'https://testnet.snowtrace.io';

  @IsIn(IPFS_DRIVERS)
  IPFS_DRIVER: IpfsDriver = 'pinata';

  @ValidateIf((env: EnvSchema) => env.IPFS_DRIVER === 'pinata')
  @IsString({ message: 'PINATA_JWT is required when IPFS_DRIVER is "pinata"' })
  PINATA_JWT?: string;

  @IsUrl(URL_OPTIONS)
  IPFS_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  TX_TIMEOUT_MS = 120_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  IPFS_TIMEOUT_MS = 600_000;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  MINT_MAX_STALLED_COUNT = 3;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_MASTER_BYTES = 2_147_483_648;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_IMAGE_BYTES = 20_971_520;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_GLB_BYTES = 52_428_800;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_VIDEO_BYTES = 104_857_600;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_PREVIEW_BYTES = 5_242_880;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  LOW_BALANCE_AVAX = 0.5;

  @Transform(toBoolean)
  @IsBoolean()
  BULL_BOARD_ENABLED = false;

  @IsOptional()
  @IsIn(FAULT_POINTS)
  FAULT_INJECT?: FaultPoint;

  /** Content & Verification base URL, for the publication lookup (NFT-02). */
  @IsUrl(URL_OPTIONS)
  CONTENT_SERVICE_URL = 'http://content:3000';

  /**
   * Secret of the NFT → Content pair (Content's `CONTENT_INBOUND_TOKEN_NFT`).
   * Optional outside production so that the service boots before the mint
   * flow needs it; the lookup then answers `content_unavailable`.
   */
  @IsOptional()
  @IsString()
  CONTENT_SERVICE_TOKEN?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60_000)
  CONTENT_TIMEOUT_MS = 3_000;
}

/** Thrown when the environment is invalid. Never contains variable values. */
export class EnvValidationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(
      `Invalid configuration:\n${problems.map((p) => `- ${p}`).join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

function isExistingAbsoluteDirectory(path: string): boolean {
  return isAbsolute(path) && existsSync(path) && statSync(path).isDirectory();
}

function crossFieldProblems(env: EnvSchema): string[] {
  const problems: string[] = [];
  if (!isExistingAbsoluteDirectory(env.MEDIA_ROOT)) {
    problems.push(
      'MEDIA_ROOT must be an absolute path to an existing directory',
    );
  }
  if (env.NODE_ENV === 'production') {
    if (env.IPFS_DRIVER === 'fake') {
      problems.push('IPFS_DRIVER must not be "fake" in production');
    }
    if (env.BULL_BOARD_ENABLED) {
      problems.push('BULL_BOARD_ENABLED must be false in production');
    }
    if (
      env.CONTENT_SERVICE_TOKEN === undefined ||
      env.CONTENT_SERVICE_TOKEN.length < MIN_SERVICE_TOKEN_LENGTH
    ) {
      problems.push(
        `CONTENT_SERVICE_TOKEN must be set in production, with at least ${String(MIN_SERVICE_TOKEN_LENGTH)} characters`,
      );
    }
  }
  return problems;
}

/** class-validator messages name the property and never echo its value. */
function messagesOf(error: ValidationError): string[] {
  return Object.values(error.constraints ?? {});
}

/**
 * Validates the raw environment for `ConfigModule.forRoot({ validate })`.
 * Empty strings count as absent so that defaults apply, and variables
 * unknown to the schema are stripped.
 */
export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const provided = Object.fromEntries(
    Object.entries(raw).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const env = plainToInstance(EnvSchema, provided, {
    exposeDefaultValues: true,
  });
  const problems = [
    ...validateSync(env, { whitelist: true }).flatMap(messagesOf),
    ...crossFieldProblems(env),
  ];
  if (problems.length > 0) {
    throw new EnvValidationError(problems);
  }
  return env;
}
