import {
  randomBytes,
  scrypt,
  type ScryptOptions,
  timingSafeEqual,
} from 'node:crypto';
import type { PasswordHasher } from '../application/ports.js';
import { AuthBusyError } from '../domain/errors.js';
import {
  type ConcurrencyLimiter,
  LimiterTimeoutError,
} from './concurrency-limiter.js';

export interface ScryptParameters {
  readonly log2N: number;
  readonly r: number;
  readonly p: number;
}

/** OWASP minimum for scrypt: N=2^17, r=8, p=1. */
export const OWASP_SCRYPT: ScryptParameters = { log2N: 17, r: 8, p: 1 };

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PREFIX = 'scrypt';

/**
 * Encodes hashes as `scrypt$<log2N>$<r>$<p>$<salt>$<key>` so that parameters can change
 * without invalidating stored hashes.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(
    private readonly limiter: ConcurrencyLimiter,
    private readonly parameters: ScryptParameters = OWASP_SCRYPT,
  ) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await this.derive(password, salt, this.parameters);
    const { log2N, r, p } = this.parameters;
    return [
      PREFIX,
      String(log2N),
      String(r),
      String(p),
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const decoded = decode(encodedHash);
    if (decoded === null) return false;
    const key = await this.derive(password, decoded.salt, decoded.parameters);
    return (
      key.length === decoded.key.length && timingSafeEqual(key, decoded.key)
    );
  }

  private async derive(
    password: string,
    salt: Buffer,
    parameters: ScryptParameters,
  ): Promise<Buffer> {
    try {
      return await this.limiter.run(() =>
        scryptAsync(password, salt, options(parameters)),
      );
    } catch (error) {
      if (error instanceof LimiterTimeoutError) throw new AuthBusyError();
      throw error;
    }
  }
}

function options({ log2N, r, p }: ScryptParameters): ScryptOptions {
  const N = 2 ** log2N;
  // scrypt needs about 128 * N * r bytes, above Node's 32 MiB default for the OWASP parameters.
  return { N, r, p, maxmem: 2 * 128 * N * r };
}

function scryptAsync(
  password: string,
  salt: Buffer,
  scryptOptions: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function decode(
  encoded: string,
): { parameters: ScryptParameters; salt: Buffer; key: Buffer } | null {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [log2N, r, p] = [parts[1], parts[2], parts[3]].map(Number);
  if (
    log2N === undefined ||
    r === undefined ||
    p === undefined ||
    ![log2N, r, p].every(Number.isSafeInteger) ||
    log2N < 1 ||
    log2N > 20
  ) {
    return null;
  }
  return {
    parameters: { log2N, r, p },
    salt: Buffer.from(parts[4] ?? '', 'base64'),
    key: Buffer.from(parts[5] ?? '', 'base64'),
  };
}
