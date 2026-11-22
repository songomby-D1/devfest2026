import type { ReactNode } from 'react';
import { isReviewer, useSession } from '../../lib/session/session';
import { Link } from '../../lib/router/Link';
import { AccountMenu } from '../account-menu/AccountMenu';
import { Logo } from '../logo/Logo';
import { NavLink } from '../nav-link/NavLink';
import styles from './PageShell.module.css';

export interface PageShellProps {
  children: ReactNode;
  /** Current section, for aria-current in the navigation. */
  current?: 'museum' | 'contribute' | 'mine' | 'review' | undefined;
  /** Narrow column for forms. */
  width?: 'narrow' | 'wide' | undefined;
}

/**
 * Frame of the account, contribution, item and review screens: the logo, the
 * navigation, the account menu and a scrolling column. The museum screens keep
 * their own full-viewport stage.
 */
export function PageShell({
  children,
  current,
  width = 'wide',
}: PageShellProps) {
  const session = useSession();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo} aria-label="LOVA, accueil">
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className={styles.nav}>
          <NavLink to="/musee" current={current === 'museum'}>
            Musée
          </NavLink>
          <NavLink to="/expositions/1">Exposition 3D</NavLink>
          <NavLink to="/contribuer" current={current === 'contribute'}>
            Déposer une œuvre
          </NavLink>
          {session.status === 'signed-in' && (
            <NavLink to="/mes-depots" current={current === 'mine'}>
              Mes dépôts
            </NavLink>
          )}
          {session.status === 'signed-in' && (
            <NavLink to="/expositions/1?creer=1">Créer en 3D</NavLink>
          )}
          {isReviewer(session) && (
            <NavLink to="/revue" current={current === 'review'}>
              Relecture
            </NavLink>
          )}
        </nav>
        <AccountMenu className={styles.account} />
      </header>
      <main className={width === 'narrow' ? styles.narrow : styles.wide}>
        {children}
      </main>
    </div>
  );
}
