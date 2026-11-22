import type { ReactNode, Ref } from 'react';
import arrowRight from '../../assets/icons/arrow-right-paper.svg';
import { cx } from '../../lib/cx';
import { Link } from '../../lib/router/Link';
import styles from './ButtonLink.module.css';

export interface ButtonLinkProps {
  to: string;
  variant: 'primary' | 'secondary';
  children: ReactNode;
  withArrow?: boolean | undefined;
  beforeNavigate?: (() => Promise<void>) | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLAnchorElement> | undefined;
}

/**
 * Figma component Button, theme Light. It stays a link because each CTA
 * navigates. Primary: ink fill with an arrow. Secondary: ink outline.
 */
export function ButtonLink({
  to,
  variant,
  children,
  withArrow = false,
  beforeNavigate,
  className,
  ref,
}: ButtonLinkProps) {
  return (
    <Link
      ref={ref}
      to={to}
      beforeNavigate={beforeNavigate}
      className={cx(styles.button, styles[variant], className)}
    >
      <span>{children}</span>
      {withArrow && (
        <img
          className={styles.arrow}
          src={arrowRight}
          width={16}
          height={16}
          alt=""
        />
      )}
    </Link>
  );
}
