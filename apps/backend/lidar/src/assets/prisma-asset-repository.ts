import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AssetAlreadyRegisteredError,
  type AssetRecord,
  type NewAsset,
} from './asset.js';
import type { AssetRepository } from './asset-repository.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByContentId(contentId: string): Promise<AssetRecord | null> {
    return this.prisma.asset3d.findUnique({ where: { contentId } });
  }

  findById(id: string): Promise<AssetRecord | null> {
    return this.prisma.asset3d.findUnique({ where: { id } });
  }

  markReady(id: string): Promise<AssetRecord> {
    return this.prisma.asset3d.update({
      where: { id },
      data: { status: 'ready' },
    });
  }

  async create(asset: NewAsset): Promise<AssetRecord> {
    try {
      return await this.prisma.asset3d.create({ data: asset });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new AssetAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
