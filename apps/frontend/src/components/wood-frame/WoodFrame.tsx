import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './WoodFrame.module.css';

export interface WoodFrameProps {
  children: ReactNode;
  className?: string | undefined;
}

/**
 * Figma component Cadre, variant Bois noir. The moulding is drawn in CSS from
 * the Figma layers (outer, edge, gorge, beads, inner, lip), so any artwork
 * image fits the opening.
 */
export function WoodFrame({ children, className }: WoodFrameProps) {
  return (
    <div className={cx(styles.frame, className)}>
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.gorge} aria-hidden="true" />
      <span className={styles.beads} aria-hidden="true" />
      <span className={styles.inner} aria-hidden="true" />
      <span className={styles.lip} aria-hidden="true" />
      <div className={styles.opening}>{children}</div>
    </div>
  );
}
