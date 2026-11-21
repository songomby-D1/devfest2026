import { describe, expect, it } from 'vitest';
import { AuthBusyError } from '../domain/errors.js';
import {
  ConcurrencyLimiter,
  LimiterTimeoutError,
} from './concurrency-limiter.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';
import { RandomSessionTokens } from './session-tokens.js';

const CHEAP = { log2N: 10, r: 8, p: 1 };

function hasher(
  limiter = new ConcurrencyLimiter(4, 1000),
): ScryptPasswordHasher {
  return new ScryptPasswordHasher(limiter, CHEAP);
}

describe('ScryptPasswordHasher', () => {
  it('verifies the original password and rejects any other', async () => {
    const subject = hasher();
    const encoded = await subject.hash('Lova heritage 2026');
    expect(await subject.verify('Lova heritage 2026', encoded)).toBe(true);
    expect(await subject.verify('Lova heritage 2027', encoded)).toBe(false);
  });

  it('stores the parameters and a random salt with each hash, never the password', async () => {
    const subject = hasher();
    const first = await subject.hash('Lova heritage 2026');
    const second = await subject.hash('Lova heritage 2026');
    expect(first).toMatch(
      /^scrypt\$10\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    );
    expect(first).not.toBe(second);
    expect(first).not.toContain('Lova');
  });

  it('keeps verifying hashes created with other parameters', async () => {
    const stronger = new ScryptPasswordHasher(new ConcurrencyLimiter(1, 1000), {
      log2N: 11,
      r: 8,
      p: 1,
    });
    const encoded = await stronger.hash('Lova heritage 2026');
    expect(await hasher().verify('Lova heritage 2026', encoded)).toBe(true);
  });

  it.each(['', 'bcrypt$x', 'scrypt$99$8$1$AA==$AA==', 'scrypt$a$b$c$d$e'])(
    'treats the malformed hash %j as a mismatch',
    async (encoded) => {
      expect(await hasher().verify('anything at all', encoded)).toBe(false);
    },
  );

  it('answers busy instead of queueing hashes without bound', async () => {
    let release: () => void = () => undefined;
    const limiter = new ConcurrencyLimiter(1, 20);
    const blocker = limiter.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await expect(
      hasher(limiter).hash('Lova heritage 2026'),
    ).rejects.toBeInstanceOf(AuthBusyError);
    release();
    await blocker;
  });
});

describe('ConcurrencyLimiter', () => {
  it('never runs more tasks than allowed at once', async () => {
    const limiter = new ConcurrencyLimiter(2, 1000);
    let running = 0;
    let peak = 0;
    const task = async (): Promise<void> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    };
    await Promise.all(Array.from({ length: 6 }, () => limiter.run(task)));
    expect(peak).toBe(2);
  });

  it('rejects a waiter after the maximum wait and frees its place', async () => {
    const limiter = new ConcurrencyLimiter(1, 10);
    let release: () => void = () => undefined;
    const first = limiter.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await expect(limiter.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      LimiterTimeoutError,
    );
    release();
    await first;
    await expect(limiter.run(() => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
  });
});

describe('RandomSessionTokens', () => {
  const tokens = new RandomSessionTokens();

  it('creates 32-byte base64url tokens that are unique', () => {
    const first = tokens.generate();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.isWellFormed(first)).toBe(true);
    expect(tokens.generate()).not.toBe(first);
  });

  it('stores a SHA-256 hex digest instead of the token', () => {
    const token = tokens.generate();
    expect(tokens.hash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hash(token)).toBe(tokens.hash(token));
  });

  it.each([
    '',
    'short',
    `${'a'.repeat(43)}=`,
    'a'.repeat(44),
    '../../etc/passwd'.padEnd(43, 'x'),
  ])('flags %j as malformed', (token) => {
    expect(tokens.isWellFormed(token)).toBe(false);
  });
});
