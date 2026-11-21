import { createHash, randomBytes } from 'node:crypto';
import type { Clock, SessionTokens } from '../application/ports.js';

const TOKEN_BYTES = 32;
/** 32 bytes in unpadded base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class RandomSessionTokens implements SessionTokens {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  /** Only this SHA-256 digest is stored, so a database leak does not expose live tokens. */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  isWellFormed(token: string): boolean {
    return TOKEN_PATTERN.test(token);
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
