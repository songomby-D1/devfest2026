import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Link } from '../../lib/router/Link';
import styles from './NavLink.module.css';

export interface NavLinkProps {
  to: string;
  children: ReactNode;
  theme?: 'light' | 'dark' | undefined;
  current?: boolean | undefined;
  /** Exit played before navigating, for example into the museum. */
  beforeNavigate?: (() => Promise<void>) | undefined;
}

/** Figma component NavLink: a quiet link with a 1 px brass underline on hover and focus. */
export function NavLink({
  to,
  children,
  theme = 'light',
  current = false,
  beforeNavigate,
}: NavLinkProps) {
  return (
    <Link
      to={to}
      className={cx(styles.link, styles[theme], current && styles.current)}
      aria-current={current ? 'page' : undefined}
      beforeNavigate={beforeNavigate}
    >
      {children}
      <span className={styles.underline} aria-hidden="true" />
    </Link>
  );
}
