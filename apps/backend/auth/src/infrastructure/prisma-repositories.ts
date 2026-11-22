import { Inject, Injectable } from '@nestjs/common';
import {
  type AccountRecord,
  type AccountRepository,
  DuplicateEmailError,
  type NewAccount,
  type NewSession,
  type SessionRecord,
  type SessionRepository,
} from '../application/ports.js';
import type { Permission } from '../domain/permission.js';
import { PrismaService } from './prisma.service.js';

const UNIQUE_VIOLATION = 'P2002';

const accountSelection = {
  id: true,
  email: true,
  displayName: true,
  passwordHash: true,
  createdAt: true,
  permissions: { select: { permission: true }, orderBy: { permission: 'asc' } },
} as const;

interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly permissions: readonly { readonly permission: Permission }[];
}

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(account: NewAccount): Promise<{ readonly id: string }> {
    try {
      return await this.prisma.account.create({
        data: account,
        select: { id: true },
      });
    } catch (error) {
      if (hasCode(error, UNIQUE_VIOLATION)) throw new DuplicateEmailError();
      throw error;
    }
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const row = await this.prisma.account.findUnique({
      where: { email },
      select: accountSelection,
    });
    return row === null ? null : toAccountRecord(row);
  }

  async findById(id: string): Promise<AccountRecord | null> {
    const row = await this.prisma.account.findUnique({
      where: { id },
      select: accountSelection,
    });
    return row === null ? null : toAccountRecord(row);
  }

  async grantPermission(
    accountId: string,
    permission: Permission,
  ): Promise<void> {
    await this.prisma.accountPermission.upsert({
      where: { accountId_permission: { accountId, permission } },
      create: { accountId, permission },
      update: {},
    });
  }

  async revokePermission(
    accountId: string,
    permission: Permission,
  ): Promise<void> {
    await this.prisma.accountPermission.deleteMany({
      where: { accountId, permission },
    });
  }
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(session: NewSession): Promise<void> {
    await this.prisma.session.create({
      data: { ...session, lastSeenAt: session.createdAt },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        accountId: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
        account: { select: { permissions: { select: { permission: true } } } },
      },
    });
    if (row === null) return null;
    return {
      id: row.id,
      accountId: row.accountId,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      revokedAt: row.revokedAt,
      permissions: row.account.permissions.map((entry) => entry.permission),
    };
  }

  async touch(sessionId: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt: at },
    });
  }

  async revokeByTokenHash(tokenHash: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async purgeInactive(now: Date, idleMs: number): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null } },
          { absoluteExpiresAt: { lte: now } },
          { lastSeenAt: { lte: new Date(now.getTime() - idleMs) } },
        ],
      },
    });
    return count;
  }
}

function toAccountRecord(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    permissions: row.permissions.map((entry) => entry.permission),
  };
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
