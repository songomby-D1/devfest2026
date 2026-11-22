import type {
  ClaimReview,
  ClaimStatus,
  ClaimStatuses as Claims,
} from '../../lib/api';
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TARGET_HINT,
  CLAIM_TARGET_LABEL,
} from '../../lib/content/labels';
import { cx } from '../../lib/cx';
import styles from './ClaimStatuses.module.css';

const ICON: Record<ClaimStatus, string> = {
  verified: '✓',
  uncertain: '?',
  unreviewed: '○',
};

export interface ClaimStatusesProps {
  claims: Claims;
  /** Latest review per target: its rationale is shown under the label. */
  reviews?: readonly ClaimReview[] | undefined;
  /** Heading level of the block title. */
  headingLevel?: 2 | 3 | undefined;
  className?: string | undefined;
}

/**
 * The two review labels of the MVP: item claims and description claims, shown
 * separately, each with an icon and a text, never merged into one badge and
 * never presented as an automated verification.
 */
export function ClaimStatuses({
  claims,
  reviews = [],
  headingLevel = 2,
  className,
}: ClaimStatusesProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={cx(styles.block, className)}
      aria-label="Relecture humaine"
    >
      <Heading className={styles.heading}>Relecture humaine</Heading>
      <p className={styles.intro}>
        Statuts attribués par des relecteurs de LOVA, séparément pour l’objet et
        pour sa description.
      </p>
      <ul className={styles.list}>
        {(['item', 'description'] as const).map((target) => {
          const status = claims[target];
          const review = reviews.find((entry) => entry.target === target);
          return (
            <li key={target} className={styles.claim} data-status={status}>
              <span className={styles.icon} aria-hidden="true">
                {ICON[status]}
              </span>
              <span className={styles.text}>
                <span className={styles.target}>
                  {CLAIM_TARGET_LABEL[target]}
                  <span className={styles.hint}>
                    {' '}
                    ({CLAIM_TARGET_HINT[target]})
                  </span>
                </span>
                <span className={styles.status}>
                  {CLAIM_STATUS_LABEL[status]}
                </span>
                {review !== undefined && status !== 'unreviewed' && (
                  <span className={styles.rationale}>
                    Note du relecteur : {review.rationale}
                    {review.evidence.length > 0 && (
                      <span className={styles.evidence}>
                        {' '}
                        Sources : {review.evidence.join(' ; ')}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
