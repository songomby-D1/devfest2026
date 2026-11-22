import type { MintVerification } from '../../lib/api';
import styles from './NftPanel.module.css';
import {
  formatDate,
  VERIFICATION_LABEL,
  verificationText,
} from './provenance-copy';

export interface VerificationBadgeProps {
  /** Absent when the service did not check the chain: shown as unverifiable. */
  verification: MintVerification | undefined;
}

const MARK = { verified: '✓', mismatch: '!', unverifiable: '?' } as const;

/** What the chain says about the certificate, compared with the gallery record. */
export function VerificationBadge({ verification }: VerificationBadgeProps) {
  const checked: MintVerification = verification ?? {
    state: 'unverifiable',
    fixity: null,
    onChain: null,
    checkedAt: '',
  };
  const checkedAt = formatDate(checked.checkedAt);
  return (
    <div className={styles.verification} data-state={checked.state}>
      <p className={styles.verificationLabel}>
        <span className={styles.verificationMark} aria-hidden="true">
          {MARK[checked.state]}
        </span>
        {VERIFICATION_LABEL[checked.state]}
      </p>
      <p className={styles.verificationText}>{verificationText(checked)}</p>
      {checkedAt && checked.state !== 'unverifiable' && (
        <p className={styles.muted}>Contrôlé le {checkedAt}.</p>
      )}
    </div>
  );
}
