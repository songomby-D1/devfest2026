import type { AnchorHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { navigate } from './router';

export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  to: string;
  children: ReactNode;
  /** Runs before client-side navigation, for example an exit animation. */
  beforeNavigate?: (() => Promise<void>) | undefined;
  ref?: Ref<HTMLAnchorElement> | undefined;
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  );
}

/** A real link that navigates on the client and keeps native behaviors. */
export function Link({
  to,
  children,
  beforeNavigate,
  onClick,
  ref,
  ...rest
}: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    const opensElsewhere = rest.target !== undefined && rest.target !== '_self';
    if (event.defaultPrevented || !isPlainLeftClick(event) || opensElsewhere) {
      return;
    }
    event.preventDefault();
    if (beforeNavigate === undefined) {
      navigate(to);
      return;
    }
    void beforeNavigate().then(() => {
      navigate(to);
    });
  }

  return (
    <a {...rest} ref={ref} href={to} onClick={handleClick}>
      {children}
    </a>
  );
}
