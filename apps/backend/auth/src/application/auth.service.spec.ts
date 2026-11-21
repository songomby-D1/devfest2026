import { beforeEach, describe, expect, it } from 'vitest';
import {
  AccountNotFoundError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  SessionInvalidError,
  ValidationFailedError,
} from '../domain/errors.js';
import type { Permission } from '../domain/permission.js';
import type { SessionLimits } from '../domain/session-policy.js';
import { RandomSessionTokens } from '../infrastructure/session-tokens.js';
import { AuthService } from './auth.service.js';
import {
  type AccountRecord,
  type AccountRepository,
  type Clock,
  DuplicateEmailError,
  type NewAccount,
  type NewSession,
  type PasswordHasher,
  type SessionRecord,
  type SessionRepository,
} from './ports.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const limits: SessionLimits = { idleMs: 2 * HOUR, absoluteMs: 7 * 24 * HOUR };
const PASSWORD = 'Lova heritage 2026';

class FakeClock implements Clock {
  current = new Date('2026-11-21T08:00:00.000Z');

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class FakeHasher implements PasswordHasher {
  readonly verified: string[] = [];

  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(password: string, encodedHash: string): Promise<boolean> {
    this.verified.push(encodedHash);
    return Promise.resolve(encodedHash === `hashed:${password}`);
  }
}

class InMemoryAccounts implements AccountRepository {
  readonly rows = new Map<
    string,
    AccountRecord & { permissions: Permission[] }
  >();
  raceOnNextCreate = false;

  create(account: NewAccount): Promise<{ readonly id: string }> {
    if (this.raceOnNextCreate) return Promise.reject(new DuplicateEmailError());
    const id = crypto.randomUUID();
    this.rows.set(id, {
      ...account,
      id,
      permissions: [],
      createdAt: new Date(),
    });
    return Promise.resolve({ id });
  }

  findByEmail(email: string): Promise<AccountRecord | null> {
    return Promise.resolve(
      [...this.rows.values()].find((row) => row.email === email) ?? null,
    );
  }

  findById(id: string): Promise<AccountRecord | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  grantPermission(accountId: string, permission: Permission): Promise<void> {
    const row = this.rows.get(accountId);
    if (row !== undefined && !row.permissions.includes(permission)) {
      row.permissions.push(permission);
    }
    return Promise.resolve();
  }

  revokePermission(accountId: string, permission: Permission): Promise<void> {
    const row = this.rows.get(accountId);
    const index = row?.permissions.indexOf(permission) ?? -1;
    if (index !== -1) row?.permissions.splice(index, 1);
    return Promise.resolve();
  }
}

interface StoredSession extends NewSession {
  id: string;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

class InMemorySessions implements SessionRepository {
  readonly rows: StoredSession[] = [];
  touches = 0;

  constructor(private readonly accounts: InMemoryAccounts) {}

  create(session: NewSession): Promise<void> {
    this.rows.push({
      ...session,
      id: crypto.randomUUID(),
      lastSeenAt: session.createdAt,
      revokedAt: null,
    });
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = this.rows.find((entry) => entry.tokenHash === tokenHash);
    if (row === undefined) return Promise.resolve(null);
    return Promise.resolve({
      ...row,
      permissions: this.accounts.rows.get(row.accountId)?.permissions ?? [],
    });
  }

  touch(sessionId: string, at: Date): Promise<void> {
    const row = this.rows.find((entry) => entry.id === sessionId);
    if (row !== undefined) row.lastSeenAt = at;
    this.touches += 1;
    return Promise.resolve();
  }

  revokeByTokenHash(tokenHash: string, at: Date): Promise<void> {
    const row = this.rows.find((entry) => entry.tokenHash === tokenHash);
    if (row !== undefined) row.revokedAt ??= at;
    return Promise.resolve();
  }

  purgeInactive(): Promise<number> {
    return Promise.resolve(0);
  }
}

describe('AuthService', () => {
  let clock: FakeClock;
  let hasher: FakeHasher;
  let accounts: InMemoryAccounts;
  let sessions: InMemorySessions;
  let service: AuthService;

  beforeEach(() => {
    clock = new FakeClock();
    hasher = new FakeHasher();
    accounts = new InMemoryAccounts();
    sessions = new InMemorySessions(accounts);
    service = new AuthService(
      accounts,
      sessions,
      hasher,
      new RandomSessionTokens(),
      clock,
      limits,
    );
  });

  async function registerAndLogin(): Promise<{
    accountId: string;
    token: string;
  }> {
    const { accountId } = await service.register({
      email: 'ana@example.org',
      password: PASSWORD,
    });
    const { token } = await service.login({
      email: 'ana@example.org',
      password: PASSWORD,
    });
    return { accountId, token };
  }

  describe('register', () => {
    it('stores only a password hash (CA1)', async () => {
      const { accountId } = await service.register({
        email: 'ana@example.org',
        password: PASSWORD,
        displayName: 'Ana',
      });
      const stored = accounts.rows.get(accountId);
      expect(stored?.passwordHash).toBe(`hashed:${PASSWORD}`);
      expect(stored?.displayName).toBe('Ana');
    });

    it('refuses a second account for the same normalized email (CA2)', async () => {
      await service.register({ email: 'ana@example.org', password: PASSWORD });
      await expect(
        service.register({ email: '  ANA@example.org ', password: PASSWORD }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
      expect(accounts.rows.size).toBe(1);
    });

    it('turns a lost unique-constraint race into a conflict', async () => {
      accounts.raceOnNextCreate = true;
      await expect(
        service.register({ email: 'ana@example.org', password: PASSWORD }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });

    it('creates nothing for invalid input (CA3)', async () => {
      await expect(
        service.register({ email: 'ana@example.org', password: 'short' }),
      ).rejects.toBeInstanceOf(ValidationFailedError);
      expect(accounts.rows.size).toBe(0);
    });
  });

  describe('login', () => {
    it('stores the token hash only and returns the session expiry (CA4)', async () => {
      const { token } = await registerAndLogin();
      expect(sessions.rows).toHaveLength(1);
      expect(sessions.rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(sessions.rows[0]?.tokenHash).not.toBe(token);
    });

    it('fails identically for a wrong password and an unknown email, hashing in both cases (CA5)', async () => {
      await service.register({ email: 'ana@example.org', password: PASSWORD });
      const wrongPassword = service.login({
        email: 'ana@example.org',
        password: 'not the password',
      });
      const unknownEmail = service.login({
        email: 'nobody@example.org',
        password: PASSWORD,
      });
      await expect(wrongPassword).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      await expect(unknownEmail).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      expect(hasher.verified).toHaveLength(2);
    });
  });

  describe('introspect', () => {
    it('returns the account, permissions and expiry, and slides the idle deadline (CA6)', async () => {
      const { accountId, token } = await registerAndLogin();
      clock.advance(90 * MINUTE);
      const first = await service.introspect(token);
      expect(first.accountId).toBe(accountId);
      expect(first.permissions).toEqual([]);
      expect(first.expiresAt).toEqual(
        new Date(clock.now().getTime() + 2 * HOUR),
      );
      expect(sessions.touches).toBe(1);

      clock.advance(90 * MINUTE);
      await expect(service.introspect(token)).resolves.toMatchObject({
        accountId,
      });
    });

    it('does not write on every request', async () => {
      const { token } = await registerAndLogin();
      clock.advance(30_000);
      await service.introspect(token);
      expect(sessions.touches).toBe(0);
    });

    it('rejects an idle session (CA7)', async () => {
      const { token } = await registerAndLogin();
      clock.advance(2 * HOUR + MINUTE);
      await expect(service.introspect(token)).rejects.toBeInstanceOf(
        SessionInvalidError,
      );
    });

    it.each(['', 'malformed', 'A'.repeat(43)])(
      'rejects the token %j',
      async (token) => {
        await expect(service.introspect(token)).rejects.toBeInstanceOf(
          SessionInvalidError,
        );
      },
    );

    it('reflects a granted then revoked reviewer permission on the next call (CA13)', async () => {
      const { token } = await registerAndLogin();
      await service.grantPermission('ANA@example.org', 'reviewer');
      await expect(service.introspect(token)).resolves.toMatchObject({
        permissions: ['reviewer'],
      });
      await service.revokePermission('ana@example.org', 'reviewer');
      await expect(service.introspect(token)).resolves.toMatchObject({
        permissions: [],
      });
    });
  });

  describe('revoke', () => {
    it('ends the session and stays idempotent (CA9)', async () => {
      const { token } = await registerAndLogin();
      await service.revoke(token);
      await expect(service.introspect(token)).rejects.toBeInstanceOf(
        SessionInvalidError,
      );
      await expect(service.revoke(token)).resolves.toBeUndefined();
      await expect(service.revoke('not-a-token')).resolves.toBeUndefined();
    });
  });

  describe('permissions and accounts', () => {
    it('reports unknown accounts', async () => {
      await expect(
        service.grantPermission('nobody@example.org', 'reviewer'),
      ).rejects.toBeInstanceOf(AccountNotFoundError);
      await expect(
        service.getAccount(crypto.randomUUID()),
      ).rejects.toBeInstanceOf(AccountNotFoundError);
    });
  });
});
