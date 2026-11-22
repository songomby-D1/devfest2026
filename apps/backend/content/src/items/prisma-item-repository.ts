import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ItemChanges, ItemRecord, NewItem } from './item';
import type { ItemRepository } from './item-repository';

const INCLUDE = { author: true, description: true } as const;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof INCLUDE }>;

/** Prisma error code for "record to update not found". */
const RECORD_NOT_FOUND = 'P2025';

function toRecord(row: ItemRow): ItemRecord {
  if (row.description === null) {
    // Items are always created with their description in one transaction.
    throw new Error('Item without description');
  }
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    kind: row.kind,
    origin: row.origin,
    period: row.period,
    author: {
      name: row.author.name,
      community: row.author.community,
      technique: row.author.technique,
    },
    rights: { statement: row.rightsStatement, confirmed: row.rightsConfirmed },
    description: {
      text: row.description.text,
      claimStatus: row.description.claimStatus,
    },
    publicationStatus: row.publicationStatus,
    submissionStatus: row.submissionStatus,
    claimStatus: row.claimStatus,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaItemRepository implements ItemRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(item: NewItem): Promise<ItemRecord> {
    // One nested write: Prisma runs it in a single transaction.
    const row = await this.prisma.item.create({
      data: {
        ownerId: item.ownerId,
        ...item.metadata,
        rightsStatement: item.rights.statement,
        rightsConfirmed: item.rights.confirmed,
        author: { create: { ...item.author } },
        description: { create: { text: item.descriptionText } },
      },
      include: INCLUDE,
    });
    return toRecord(row);
  }

  async findById(id: string): Promise<ItemRecord | null> {
    const row = await this.prisma.item.findUnique({
      where: { id },
      include: INCLUDE,
    });
    return row === null ? null : toRecord(row);
  }

  async updateUnpublished(
    id: string,
    changes: ItemChanges,
  ): Promise<ItemRecord | null> {
    const description: Prisma.DescriptionUpdateWithoutItemInput = {
      ...(changes.descriptionText === undefined
        ? {}
        : { text: changes.descriptionText }),
      ...(changes.resetDescriptionClaim ? { claimStatus: 'unreviewed' } : {}),
    };
    try {
      // The status filter makes the edit fail if the item was published
      // between the read and this write.
      const row = await this.prisma.item.update({
        where: { id, publicationStatus: { not: 'published' } },
        data: {
          ...changes.metadata,
          ...(changes.rights?.statement === undefined
            ? {}
            : { rightsStatement: changes.rights.statement }),
          ...(changes.rights?.confirmed === undefined
            ? {}
            : { rightsConfirmed: changes.rights.confirmed }),
          ...(changes.resetItemClaim ? { claimStatus: 'unreviewed' } : {}),
          ...(changes.author === undefined
            ? {}
            : { author: { update: { ...changes.author } } }),
          ...(Object.keys(description).length === 0
            ? {}
            : { description: { update: description } }),
          // Nested-only edits must still move the item's updatedAt.
          updatedAt: new Date(),
        },
        include: INCLUDE,
      });
      return toRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }
}
