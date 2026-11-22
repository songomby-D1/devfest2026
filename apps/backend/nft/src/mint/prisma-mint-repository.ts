import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMintResult, MintRepository } from './mint-repository';
import type {
  MintPatch,
  MintRequestRecord,
  NewMintRequest,
} from './mint-request';

const LIVE_STATUSES = ['pending', 'confirmed'] as const;

/** Unique violation, from either unique index of `mint_requests`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/** `mint_requests` through Prisma on the runtime role (D04). */
@Injectable()
export class PrismaMintRepository implements MintRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<MintRequestRecord | null> {
    return this.prisma.mintRequest.findUnique({ where: { id } });
  }

  findByKey(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<MintRequestRecord | null> {
    return this.prisma.mintRequest.findUnique({
      where: { requesterId_idempotencyKey: { requesterId, idempotencyKey } },
    });
  }

  findLiveForContent(contentId: string): Promise<MintRequestRecord | null> {
    return this.prisma.mintRequest.findFirst({
      where: { contentId, status: { in: [...LIVE_STATUSES] } },
    });
  }

  async findLatestForContent(
    contentId: string,
  ): Promise<MintRequestRecord | null> {
    return (
      (await this.findLiveForContent(contentId)) ??
      this.prisma.mintRequest.findFirst({
        where: { contentId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    );
  }

  async create(input: NewMintRequest): Promise<CreateMintResult> {
    try {
      const record = await this.prisma.mintRequest.create({ data: input });
      return { kind: 'created', record };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // The key index wins over the item index: a replay of the same key
      // returns the first request even if it is the item's live one.
      const existing = await this.findByKey(
        input.requesterId,
        input.idempotencyKey,
      );
      return existing === null
        ? { kind: 'item_busy' }
        : { kind: 'key_exists', record: existing };
    }
  }

  listPending(limit: number): Promise<readonly MintRequestRecord[]> {
    return this.prisma.mintRequest.findMany({
      where: { status: 'pending' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async updatePending(
    id: string,
    patch: MintPatch,
  ): Promise<MintRequestRecord | null> {
    const { count } = await this.prisma.mintRequest.updateMany({
      where: { id, status: 'pending' },
      data: patch,
    });
    return count === 0 ? null : this.findById(id);
  }
}
