import { useState } from 'react';
import { cx } from '../../lib/cx';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import {
  currentPath,
  isReviewer,
  signInPath,
  signOut,
  useSession,
} from '../../lib/session/session';
import styles from './AccountMenu.module.css';

export interface AccountMenuProps {
  theme?: 'light' | 'dark' | undefined;
  className?: string | undefined;
}

/** Signed-in state in the header: the account, the reviewer capability and sign-out. */
export function AccountMenu({ theme = 'light', className }: AccountMenuProps) {
  const session = useSession();
  const [busy, setBusy] = useState(false);

  if (session.status === 'unknown' || session.status === 'loading') {
    return (
      <span
        className={cx(styles.menu, styles[theme], className)}
        aria-hidden="true"
      />
    );
  }

  if (session.status === 'guest') {
    return (
      <div className={cx(styles.menu, styles[theme], className)}>
        <Link to={signInPath(currentPath())} className={styles.link}>
          Se connecter
        </Link>
      </div>
    );
  }

  const { me } = session;
  return (
    <div className={cx(styles.menu, styles[theme], className)}>
      <span className={styles.who}>
        <span className="visually-hidden">Connecté en tant que </span>
        {me.displayName ?? me.email}
        {isReviewer(session) && <span className={styles.role}>Relecteur</span>}
      </span>
      <button
        type="button"
        className={styles.link}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOut()
            .catch(() => undefined)
            .finally(() => {
              setBusy(false);
              navigate('/');
            });
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}
