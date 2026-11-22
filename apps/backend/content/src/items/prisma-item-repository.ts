import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ClaimReviewChange,
  ClaimReviewRecord,
  ItemChanges,
  ItemListFilter,
  ItemRecord,
  MediaChange,
  MediaChangeResult,
  MediaRecord,
  NewItem,
  PublicationTransition,
} from './item';
import type { ItemRepository } from './item-repository';
import { claimStatusOf, nextReviewTime, resubmittedStatus } from './review';

const INCLUDE = {
  author: true,
  description: true,
  media: { orderBy: { position: 'asc' } },
  // The latest review of each target (reviewedAt is strictly increasing).
  claimReviews: { orderBy: { reviewedAt: 'desc' }, distinct: ['target'] },
} as const satisfies Prisma.ItemInclude;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof INCLUDE }>;
type MediaRow = ItemRow['media'][number];
type ReviewRow = ItemRow['claimReviews'][number];
type Transaction = Prisma.TransactionClient;

function toReviewRecord(row: ReviewRow): ClaimReviewRecord {
  if (row.outcome === 'unreviewed') {
    // Excluded by the claim_reviews_outcome_reviewed check constraint.
    throw new Error('Claim review without an outcome');
  }
  return {
    target: row.target,
    fromStatus: row.fromStatus,
    outcome: row.outcome,
    rationale: row.rationale,
    evidence: row.evidence,
    reviewerId: row.reviewerId,
    reviewedAt: row.reviewedAt,
  };
}

/** Locks the item row and reads it, inside a transaction. */
async function lockItem(tx: Transaction, id: string): Promise<ItemRow | null> {
  // The row lock serializes every change of an item: edits, media changes,
  // reviews and publication decisions, so each one decides on the state
  // that its write relies on.
  await tx.$queryRaw`SELECT 1 FROM items WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.item.findUnique({ where: { id }, include: INCLUDE });
}

function toMediaRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    kind: row.kind,
    // Only allowlisted types are ever written (media-format.ts).
    contentType: row.contentType as MediaRecord['contentType'],
    bytes: row.bytes,
    sha256: row.sha256,
    storageKey: row.storageKey,
    caption: row.caption,
    position: row.position,
    createdAt: row.createdAt,
  };
}

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
    media: row.media.map(toMediaRecord),
    latestReviews: row.claimReviews.map(toReviewRecord),
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
      const row = await lockItem(tx, id);
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

  async changeMedia(
    id: string,
    decide: (current: ItemRecord) => MediaChange,
  ): Promise<MediaChangeResult | null> {
    return this.prisma.$transaction(async (tx) => {
      // A media change cannot interleave with a review or a publish that
      // relies on the item claim.
      const row = await lockItem(tx, id);
      if (row === null) return null;
      const current = toRecord(row);
      const change = decide(current);

      const removed =
        change.removeId === undefined
          ? null
          : (current.media.find((media) => media.id === change.removeId) ??
            null);
      if (removed !== null) {
        await tx.media.delete({ where: { id: removed.id } });
      }
      let added: MediaRecord | null = null;
      if (change.add !== undefined) {
        const position =
          removed?.position ?? (current.media.at(-1)?.position ?? -1) + 1;
        added = toMediaRecord(
          await tx.media.create({
            data: { ...change.add, itemId: id, position },
          }),
        );
      }
      if (removed === null && added === null) {
        return { item: current, added, removed };
      }
      await markAdvisorySignalsStale(tx, id, [removed?.id, added?.id]);
      const updated = await tx.item.update({
        where: { id },
        // A media change is a material change of the item claims (D18).
        data: {
          claimStatus: 'unreviewed',
          submissionStatus: resubmittedStatus(current.submissionStatus),
          updatedAt: new Date(),
        },
        include: INCLUDE,
      });
      return { item: toRecord(updated), added, removed };
    });
  }

  async changeDetails(
    id: string,
    decide: (current: ItemRecord) => ItemChanges | null,
  ): Promise<ItemRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockItem(tx, id);
      if (row === null) return null;
      const current = toRecord(row);
      const changes = decide(current);
      if (changes === null) return current;
      const description: Prisma.DescriptionUpdateWithoutItemInput = {
        ...(changes.descriptionText === undefined
          ? {}
          : { text: changes.descriptionText }),
        ...(changes.resetDescriptionClaim ? { claimStatus: 'unreviewed' } : {}),
      };
      const updated = await tx.item.update({
        where: { id },
        data: {
          ...changes.metadata,
          ...(changes.rights?.statement === undefined
            ? {}
            : { rightsStatement: changes.rights.statement }),
          ...(changes.rights?.confirmed === undefined
            ? {}
            : { rightsConfirmed: changes.rights.confirmed }),
          ...(changes.resetItemClaim ? { claimStatus: 'unreviewed' } : {}),
          submissionStatus: resubmittedStatus(current.submissionStatus),
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
      return toRecord(updated);
    });
  }

  async reviewClaim(
    id: string,
    decide: (current: ItemRecord) => ClaimReviewChange,
  ): Promise<ItemRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockItem(tx, id);
      if (row === null) return null;
      const current = toRecord(row);
      const review = decide(current);
      const latest = current.latestReviews.find(
        (existing) => existing.target === review.target,
      );
      await tx.claimReview.create({
        data: {
          itemId: id,
          target: review.target,
          fromStatus: claimStatusOf(current, review.target),
          outcome: review.outcome,
          rationale: review.rationale,
          evidence: [...review.evidence],
          reviewerId: review.reviewerId,
          reviewedAt: nextReviewTime(latest, new Date()),
        },
      });
      // The only write of a reviewed claim status (CONTENT-04 guardrail).
      const updated = await tx.item.update({
        where: { id },
        data:
          review.target === 'item'
            ? { claimStatus: review.outcome, updatedAt: new Date() }
            : {
                description: { update: { claimStatus: review.outcome } },
                updatedAt: new Date(),
              },
        include: INCLUDE,
      });
      return toRecord(updated);
    });
  }
}

/**
 * Staleness hook for advisory signals (ai-assisted-analysis-spike.md,
 * "Staleness"): a media change makes the `ai_generated` signals of that
 * media and every `description_mismatch` signal of the item stale, in the
 * same transaction. The `advisory_signals` table arrives with CONTENT-06, so
 * there is nothing to mark yet.
 */
function markAdvisorySignalsStale(
  _tx: Transaction,
  _itemId: string,
  _mediaIds: readonly (string | undefined)[],
): Promise<void> {
  return Promise.resolve();
}
