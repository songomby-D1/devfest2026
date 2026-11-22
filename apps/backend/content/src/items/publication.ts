import { HttpStatus } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import type { ItemRecord, PublicationTransition } from './item';
import { notInReview } from './review';

/** Rule codes answered with `422` when an item cannot be published (D18). */
export const PUBLISH_RULES = {
  SUBMISSION_NOT_PUBLISHABLE:
    'Only a submission in review or already accepted can be published',
  CLAIMS_UNREVIEWED:
    'Both the item claims and the description claims must be reviewed first',
  RIGHTS_NOT_CONFIRMED: 'The rights must be confirmed before publication',
} as const;
export type PublishRule = keyof typeof PUBLISH_RULES;

export const ITEM_NOT_PUBLISHED = 'ITEM_NOT_PUBLISHED';

/**
 * Returns the first rule that blocks publication, or `null`. An `uncertain`
 * outcome counts as reviewed: it stays visibly qualified once published (MVP
 * B). A `returned` or `rejected` submission waits for the review workflow.
 */
export function publishBlocker(item: ItemRecord): PublishRule | null {
  if (
    item.submissionStatus !== 'in_review' &&
    item.submissionStatus !== 'accepted'
  ) {
    return 'SUBMISSION_NOT_PUBLISHABLE';
  }
  if (
    item.claimStatus === 'unreviewed' ||
    item.description.claimStatus === 'unreviewed'
  ) {
    return 'CLAIMS_UNREVIEWED';
  }
  if (!item.rights.confirmed) return 'RIGHTS_NOT_CONFIRMED';
  return null;
}

/**
 * `draft` or `unpublished` to `published`. Publishing a published item is a
 * no-op, so a retried decision is harmless. The submission becomes
 * `accepted`, and `publishedAt` records the latest publication.
 */
export function planPublish(
  item: ItemRecord,
  actorId: string,
  note: string,
  now: Date,
): PublicationTransition | null {
  if (item.publicationStatus === 'published') return null;
  const rule = publishBlocker(item);
  if (rule !== null) {
    throw new PublicError(
      rule,
      PUBLISH_RULES[rule],
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  return {
    action: 'publish',
    actorId,
    note,
    publicationStatus: 'published',
    submissionStatus: 'accepted',
    publishedAt: now,
  };
}

/**
 * `published` to `unpublished`. The item leaves public browsing at once and
 * keeps its last `publishedAt`. Unpublishing an unpublished item is a no-op;
 * a draft was never published and answers `409`.
 */
export function planUnpublish(
  item: ItemRecord,
  actorId: string,
  note: string,
): PublicationTransition | null {
  if (item.publicationStatus === 'unpublished') return null;
  if (item.publicationStatus === 'draft') {
    throw new PublicError(
      ITEM_NOT_PUBLISHED,
      'Only a published item can be unpublished',
      HttpStatus.CONFLICT,
    );
  }
  return {
    action: 'unpublish',
    actorId,
    note,
    publicationStatus: 'unpublished',
    submissionStatus: item.submissionStatus,
    publishedAt: item.publishedAt,
  };
}

/**
 * `in_review` to `returned` (CONTENT-04): the reviewer sends the submission
 * back to its owner for changes. The owner's next edit puts it back
 * `in_review`. Returning a returned item is a no-op, so a retry is harmless.
 * The publication status does not change: an item in review is never
 * published.
 */
export function planReturn(
  item: ItemRecord,
  actorId: string,
  note: string,
): PublicationTransition | null {
  if (item.submissionStatus === 'returned') return null;
  if (item.submissionStatus !== 'in_review') {
    throw notInReview('Only a submission in review can be returned');
  }
  return {
    action: 'return',
    actorId,
    note,
    publicationStatus: item.publicationStatus,
    submissionStatus: 'returned',
    publishedAt: item.publishedAt,
  };
}

/**
 * `in_review` or `returned` to `rejected` (CONTENT-04). Rejection closes the
 * submission for good: it can no longer be edited, reviewed or published,
 * and the owner submits a new item instead. Rejecting a rejected item is a
 * no-op. An `accepted` submission is taken down with unpublish instead.
 */
export function planReject(
  item: ItemRecord,
  actorId: string,
  note: string,
): PublicationTransition | null {
  if (item.submissionStatus === 'rejected') return null;
  if (item.submissionStatus === 'accepted') {
    throw notInReview(
      'An accepted submission cannot be rejected; unpublish it instead',
    );
  }
  return {
    action: 'reject',
    actorId,
    note,
    publicationStatus: item.publicationStatus,
    submissionStatus: 'rejected',
    publishedAt: item.publishedAt,
  };
}
