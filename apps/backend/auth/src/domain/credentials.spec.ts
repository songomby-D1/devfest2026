import { describe, expect, it } from 'vitest';
import {
  codePointLength,
  normalizeDisplayName,
  parseCredentials,
  parseRegistration,
} from './credentials.js';
import { ValidationFailedError } from './errors.js';

const PASSWORD = 'correct horse battery';

function issuesOf(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    if (error instanceof ValidationFailedError) return error.details;
    throw error;
  }
  throw new Error('Expected a validation failure');
}

describe('parseRegistration', () => {
  it('trims and lower-cases the email before any check (CA2)', () => {
    const registration = parseRegistration({
      email: '  ANA@Example.org ',
      password: PASSWORD,
    });
    expect(registration.email).toBe('ana@example.org');
  });

  it.each([
    ['not-an-email', 'invalid'],
    ['ana@localhost', 'invalid'],
    ['', 'required'],
    [`${'a'.repeat(250)}@example.org`, 'too_long'],
  ])('rejects the email %j (CA3)', (email, reason) => {
    expect(
      issuesOf(() => parseRegistration({ email, password: PASSWORD })),
    ).toEqual([{ field: 'email', reason }]);
  });

  it('enforces 12 to 128 code points inclusive (CA3)', () => {
    const email = 'ana@example.org';
    expect(() =>
      parseRegistration({ email, password: 'a'.repeat(12) }),
    ).not.toThrow();
    expect(() =>
      parseRegistration({ email, password: 'a'.repeat(128) }),
    ).not.toThrow();
    expect(
      issuesOf(() => parseRegistration({ email, password: 'a'.repeat(11) })),
    ).toEqual([{ field: 'password', reason: 'too_short' }]);
    expect(
      issuesOf(() => parseRegistration({ email, password: 'a'.repeat(129) })),
    ).toEqual([{ field: 'password', reason: 'too_long' }]);
  });

  it('counts emoji and accented letters once and accepts spaces', () => {
    const password = '🌿é '.repeat(4);
    expect(codePointLength(password)).toBe(12);
    expect(() =>
      parseRegistration({ email: 'ana@example.org', password }),
    ).not.toThrow();
  });

  it('normalizes passwords with NFKC so equivalent forms match', () => {
    const composed = parseRegistration({
      email: 'a@b.mg',
      password: 'Ｌｏｖａ heritage 2026',
    });
    expect(composed.password).toBe('Lova heritage 2026');
  });

  it('reports every failing field at once', () => {
    expect(
      issuesOf(() => parseRegistration({ email: 'x', password: 'short' })),
    ).toEqual([
      { field: 'email', reason: 'invalid' },
      { field: 'password', reason: 'too_short' },
    ]);
  });

  it('collapses the display name and rejects names longer than 60 code points', () => {
    expect(normalizeDisplayName('  Rova   Rakoto ')).toBe('Rova Rakoto');
    expect(normalizeDisplayName('   ')).toBeNull();
    expect(
      issuesOf(() =>
        parseRegistration({
          email: 'ana@example.org',
          password: PASSWORD,
          displayName: 'n'.repeat(61),
        }),
      ),
    ).toEqual([{ field: 'displayName', reason: 'too_long' }]);
  });
});

describe('parseCredentials', () => {
  it('accepts a short password so that it is verified like any other (CA5)', () => {
    expect(
      parseCredentials({ email: 'Ana@example.org', password: 'short' }),
    ).toEqual({
      email: 'ana@example.org',
      password: 'short',
    });
  });

  it('rejects a password longer than 128 code points before hashing', () => {
    expect(
      issuesOf(() =>
        parseCredentials({
          email: 'ana@example.org',
          password: 'a'.repeat(129),
        }),
      ),
    ).toEqual([{ field: 'password', reason: 'too_long' }]);
  });
});
