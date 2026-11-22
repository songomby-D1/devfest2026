import type { CallerContext } from '../common/caller-context';
import { isReviewer } from '../common/caller-context';
import type {
  ClaimStatus,
  ItemKind,
  ItemRecord,
  PublicationStatus,
  SubmissionStatus,
} from './item';

/** `ItemDetail` of the gateway contract (packages/shared `content.ts`). */
export interface ItemDetailView {
  readonly id: string;
  readonly title: string;
  readonly kind: ItemKind;
  readonly creatorName: string | null;
  readonly origin: string | null;
  readonly period: string | null;
  readonly thumbnailUrl: string | null;
  readonly publicationStatus: PublicationStatus;
  readonly submissionStatus: SubmissionStatus;
  readonly claims: {
    readonly item: ClaimStatus;
    readonly description: ClaimStatus;
  };
  readonly updatedAt: string;
  readonly description: string;
  readonly creator: {
    readonly name: string | null;
    readonly community: string | null;
    readonly technique: string | null;
  };
  readonly rights: { readonly statement: string; readonly confirmed: boolean };
  readonly media: readonly never[];
  readonly reviews: readonly never[];
  readonly isOwner: boolean;
  readonly advisorySignals?: readonly never[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

/**
 * Maps a record to the contract shape. Media (CONTENT-03), reviews
 * (CONTENT-04) and advisory signals (CONTENT-05c) are empty until those tasks
 * land; advisory signals are only present for the owner and reviewers.
 */
export function toItemDetail(
  item: ItemRecord,
  caller: CallerContext,
): ItemDetailView {
  const isOwner = caller.userId !== null && caller.userId === item.ownerId;
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    creatorName: item.author.name,
    origin: item.origin,
    period: item.period,
    thumbnailUrl: null,
    publicationStatus: item.publicationStatus,
    submissionStatus: item.submissionStatus,
    claims: {
      item: item.claimStatus,
      description: item.description.claimStatus,
    },
    updatedAt: item.updatedAt.toISOString(),
    description: item.description.text,
    creator: { ...item.author },
    rights: { ...item.rights },
    media: [],
    reviews: [],
    isOwner,
    ...(isOwner || isReviewer(caller) ? { advisorySignals: [] } : {}),
    createdAt: item.createdAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  };
}
