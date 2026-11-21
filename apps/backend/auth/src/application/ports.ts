import type { Permission } from '../domain/permission.js';

export interface AccountRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly passwordHash: string;
  readonly permissions: readonly Permission[];
  readonly createdAt: Date;
}

export interface NewAccount {
  readonly email: string;
  readonly displayName: string | null;
  readonly passwordHash: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
  readonly permissions: readonly Permission[];
}

export interface NewSession {
  readonly accountId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
  readonly absoluteExpiresAt: Date;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('Duplicate email');
    this.name = 'DuplicateEmailError';
  }
}

export interface AccountRepository {
  /** Throws `DuplicateEmailError` when the email is already taken. */
  create(account: NewAccount): Promise<{ readonly id: string }>;
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  grantPermission(accountId: string, permission: Permission): Promise<void>;
  revokePermission(accountId: string, permission: Permission): Promise<void>;
}

export interface SessionRepository {
  create(session: NewSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touch(sessionId: string, at: Date): Promise<void>;
  revokeByTokenHash(tokenHash: string, at: Date): Promise<void>;
  /** Deletes revoked sessions and sessions past their idle or absolute deadline. */
  purgeInactive(now: Date, idleMs: number): Promise<number>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

export interface SessionTokens {
  generate(): string;
  hash(token: string): string;
  isWellFormed(token: string): boolean;
}

export interface Clock {
  now(): Date;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const SESSION_TOKENS = Symbol('SESSION_TOKENS');
export const CLOCK = Symbol('CLOCK');
export const SESSION_LIMITS = Symbol('SESSION_LIMITS');
