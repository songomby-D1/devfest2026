import type { ReactNode } from 'react';
import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  label: string;
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative' | undefined;
}

/** A labelled status, such as "Publication : Brouillon". Text carries the meaning, not color. */
export function StatusBadge({
  label,
  children,
  tone = 'neutral',
}: StatusBadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      <span className={styles.label}>{label} :</span> {children}
    </span>
  );
}
