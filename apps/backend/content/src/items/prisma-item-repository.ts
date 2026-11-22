import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ItemChanges,
  ItemListFilter,
  ItemRecord,
  NewItem,
  PublicationTransition,
} from './item';
import type { ItemRepository } from './item-repository';

const INCLUDE = { author: true, description: true } as const;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof INCLUDE }>;

/** Prisma error code for "record to update not found". */
const RECORD_NOT_FOUND = 'P2025';

/** Escapes LIKE wildcards so that `q` matches literally. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function listWhere(filter: ItemListFilter): Prisma.ItemWhereInput {
  const conditions: Prisma.ItemWhereInput[] = [];
  if (filter.publicationStatus !== undefined) {
    conditions.push({ publicationStatus: filter.publicationStatus });
  }
  if (filter.submissionStatus !== undefined) {
    conditions.push({ submissionStatus: filter.submissionStatus });
  }
  if (filter.ownerId !== undefined) {
    conditions.push({ ownerId: filter.ownerId });
  }
  if (filter.excludeOwnerId !== undefined) {
    conditions.push({ ownerId: { not: filter.excludeOwnerId } });
  }
  if (filter.kind !== undefined) conditions.push({ kind: filter.kind });
  if (filter.text !== undefined) {
    const contains = likeLiteral(filter.text);
    conditions.push({
      OR: [
        { title: { contains, mode: 'insensitive' } },
        { author: { name: { contains, mode: 'insensitive' } } },
      ],
    });
  }
  if (filter.after !== undefined) {
    const { createdAt, id } = filter.after;
    const beyond = filter.order === 'newest_first' ? 'lt' : 'gt';
    conditions.push({
      OR: [
        { createdAt: { [beyond]: createdAt } },
        { createdAt, id: { [beyond]: id } },
      ],
    });
  }
  return { AND: conditions };
}

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

  async list(filter: ItemListFilter): Promise<ItemRecord[]> {
    const direction = filter.order === 'newest_first' ? 'desc' : 'asc';
    const rows = await this.prisma.item.findMany({
      where: listWhere(filter),
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: filter.limit,
      include: INCLUDE,
    });
    return rows.map(toRecord);
  }

  async changePublication(
    id: string,
    decide: (current: ItemRecord) => PublicationTransition | null,
  ): Promise<ItemRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      // The row lock serializes publication changes and edits of the item,
      // so `decide` sees the claim statuses that the update will rely on.
      await tx.$queryRaw`SELECT 1 FROM items WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.item.findUnique({ where: { id }, include: INCLUDE });
      if (row === null) return null;
      const current = toRecord(row);
      const transition = decide(current);
      if (transition === null) return current;
      const updated = await tx.item.update({
        where: { id },
        data: {
          publicationStatus: transition.publicationStatus,
          submissionStatus: transition.submissionStatus,
          publishedAt: transition.publishedAt,
          publicationEvents: {
            create: {
              action: transition.action,
              actorId: transition.actorId,
              note: transition.note,
            },
          },
        },
        include: INCLUDE,
      });
      return toRecord(updated);
    });
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
