import { cx } from '../../lib/cx';
import styles from './Logo.module.css';

export interface LogoProps {
  className?: string | undefined;
}

/**
 * The LOVA mark: the baobab wearing the lamba (public/brand/lova.svg, one
 * cached sprite) and the wide uppercase name, in the current text color.
 * Decorative: the surrounding link carries the accessible name.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cx(styles.logo, className)} aria-hidden="true">
      <svg className={styles.mark} viewBox="36 78 356 304" focusable="false">
        <use href="/brand/lova.svg#lova" />
      </svg>
      <span className={styles.word}>Lova</span>
    </span>
  );
}
