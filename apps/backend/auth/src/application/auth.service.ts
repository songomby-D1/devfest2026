import { Inject, Injectable } from '@nestjs/common';
import {
  normalizeEmail,
  parseCredentials,
  parseRegistration,
} from '../domain/credentials.js';
import {
  AccountNotFoundError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  SessionInvalidError,
} from '../domain/errors.js';
import type { Permission } from '../domain/permission.js';
import {
  absoluteExpiry,
  isSessionActive,
  type SessionLimits,
  sessionExpiry,
  shouldTouch,
} from '../domain/session-policy.js';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  CLOCK,
  type Clock,
  DuplicateEmailError,
  PASSWORD_HASHER,
  type PasswordHasher,
  SESSION_LIMITS,
  SESSION_REPOSITORY,
  SESSION_TOKENS,
  type SessionRepository,
  type SessionTokens,
} from './ports.js';

export interface AccountView {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly permissions: readonly Permission[];
  readonly createdAt: Date;
}

export interface OpenedSession {
  readonly accountId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface Introspection {
  readonly accountId: string;
  readonly permissions: readonly Permission[];
  readonly expiresAt: Date;
}

export interface RegistrationInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string | null | undefined;
}

export interface CredentialsInput {
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_TOKENS) private readonly tokens: SessionTokens,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SESSION_LIMITS) private readonly limits: SessionLimits,
  ) {}

  async register(
    input: RegistrationInput,
  ): Promise<{ readonly accountId: string }> {
    const registration = parseRegistration(input);
    if ((await this.accounts.findByEmail(registration.email)) !== null) {
      throw new EmailAlreadyRegisteredError();
    }
    const passwordHash = await this.hasher.hash(registration.password);
    try {
      const { id } = await this.accounts.create({
        email: registration.email,
        displayName: registration.displayName,
        passwordHash,
      });
      return { accountId: id };
    } catch (error) {
      // A concurrent registration won the unique constraint.
      if (error instanceof DuplicateEmailError) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async login(input: CredentialsInput): Promise<OpenedSession> {
    const credentials = parseCredentials(input);
    const account = await this.accounts.findByEmail(credentials.email);
    // Unknown emails still pay for one hash so that timing does not reveal registered accounts.
    const encodedHash = account?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(credentials.password, encodedHash);
    if (account === null || !valid) throw new InvalidCredentialsError();

    const token = this.tokens.generate();
    const now = this.clock.now();
    await this.sessions.create({
      accountId: account.id,
      tokenHash: this.tokens.hash(token),
      createdAt: now,
      absoluteExpiresAt: absoluteExpiry(now, this.limits),
    });
    return {
      accountId: account.id,
      token,
      expiresAt: sessionExpiry(
        { createdAt: now, lastSeenAt: now },
        this.limits,
      ),
    };
  }

  async introspect(token: string): Promise<Introspection> {
    if (!this.tokens.isWellFormed(token)) throw new SessionInvalidError();
    const session = await this.sessions.findByTokenHash(
      this.tokens.hash(token),
    );
    const now = this.clock.now();
    if (session === null || !isSessionActive(session, now, this.limits)) {
      throw new SessionInvalidError();
    }
    let lastSeenAt = session.lastSeenAt;
    if (shouldTouch(lastSeenAt, now)) {
      await this.sessions.touch(session.id, now);
      lastSeenAt = now;
    }
    return {
      accountId: session.accountId,
      permissions: session.permissions,
      expiresAt: sessionExpiry(
        { createdAt: session.createdAt, lastSeenAt },
        this.limits,
      ),
    };
  }

  async revoke(token: string): Promise<void> {
    if (!this.tokens.isWellFormed(token)) return;
    await this.sessions.revokeByTokenHash(
      this.tokens.hash(token),
      this.clock.now(),
    );
  }

  async getAccount(accountId: string): Promise<AccountView> {
    const account = await this.accounts.findById(accountId);
    if (account === null) throw new AccountNotFoundError();
    return {
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      permissions: account.permissions,
      createdAt: account.createdAt,
    };
  }

  async grantPermission(email: string, permission: Permission): Promise<void> {
    const accountId = await this.requireAccountIdByEmail(email);
    await this.accounts.grantPermission(accountId, permission);
  }

  async revokePermission(email: string, permission: Permission): Promise<void> {
    const accountId = await this.requireAccountIdByEmail(email);
    await this.accounts.revokePermission(accountId, permission);
  }

  purgeSessions(): Promise<number> {
    return this.sessions.purgeInactive(this.clock.now(), this.limits.idleMs);
  }

  private async requireAccountIdByEmail(email: string): Promise<string> {
    const account = await this.accounts.findByEmail(normalizeEmail(email));
    if (account === null) throw new AccountNotFoundError();
    return account.id;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(this.tokens.generate());
    return this.dummyHash;
  }
}
