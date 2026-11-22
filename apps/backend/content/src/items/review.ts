import { HttpStatus } from '@nestjs/common';
import { PublicError } from '../common/public-error';
import type {
  ClaimReviewChange,
  ClaimReviewRecord,
  ClaimStatus,
  ClaimTarget,
  ItemRecord,
  SubmissionStatus,
} from './item';
import type { ReviewInput } from './item-schemas';

/** `422`: a review or a `return` needs a submission `in_review`. */
export const SUBMISSION_NOT_IN_REVIEW = 'SUBMISSION_NOT_IN_REVIEW';
/** `409`: a rejected submission is closed; its owner submits a new item. */
export const SUBMISSION_REJECTED = 'SUBMISSION_REJECTED';

export function notInReview(message: string): PublicError {
  return new PublicError(
    SUBMISSION_NOT_IN_REVIEW,
    message,
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function rejectedConflict(): PublicError {
  return new PublicError(
    SUBMISSION_REJECTED,
    'A rejected submission cannot be changed',
    HttpStatus.CONFLICT,
  );
}

/**
 * The submission status after an owner edit (CONTENT-04). A `returned`
 * submission, or an `accepted` one that was unpublished, goes back
 * `in_review` so that it shows up in the review queue again. Callers refuse
 * edits of `published` and `rejected` items before this applies.
 */
export function resubmittedStatus(current: SubmissionStatus): SubmissionStatus {
  return current === 'returned' || current === 'accepted'
    ? 'in_review'
    : current;
}

export function claimStatusOf(
  item: ItemRecord,
  target: ClaimTarget,
): ClaimStatus {
  return target === 'item' ? item.claimStatus : item.description.claimStatus;
}

/**
 * Checks a claim review against the locked current record. The reviewer has
 * the permission already; they cannot review their own submission, and only
 * a submission `in_review` is open to review. A published item is always
 * `accepted`, so it is never reviewed in place.
 */
export function planReview(
  item: ItemRecord,
  reviewerId: string,
  input: ReviewInput,
): ClaimReviewChange {
  if (item.ownerId === reviewerId) {
    throw PublicError.forbidden('A reviewer cannot review their own item');
  }
  if (item.submissionStatus !== 'in_review') {
    throw notInReview('Only a submission in review can be reviewed');
  }
  return {
    target: input.target,
    outcome: input.outcome,
    rationale: input.rationale,
    evidence: input.evidence,
    reviewerId,
  };
}

/**
 * The time of a new review: now, or just after the latest review of the
 * same target. Reviews are written under the item lock, so this keeps the
 * history strictly ordered even when two reviews fall in one millisecond.
 */
export function nextReviewTime(
  latest: ClaimReviewRecord | undefined,
  now: Date,
): Date {
  if (latest === undefined || latest.reviewedAt < now) return now;
  return new Date(latest.reviewedAt.getTime() + 1);
}

/**
 * The reviews shown in `ItemDetail.reviews`: the latest one per target, but
 * only while that claim still carries a reviewed status. After an edit
 * resets a claim to `unreviewed`, its old review no longer describes the
 * current content and stays in the history only.
 */
export function currentReviews(item: ItemRecord): ClaimReviewRecord[] {
  return item.latestReviews.filter(
    (review) => claimStatusOf(item, review.target) !== 'unreviewed',
  );
}
