import type { ReactNode } from 'react';
import type { Me } from '../../lib/api';
import { Link } from '../../lib/router/Link';
import {
  currentPath,
  isReviewer,
  signInPath,
  useSession,
} from '../../lib/session/session';
import forms from '../forms/forms.module.css';

export interface RequireUserProps {
  /** What the protected action is, for the sign-in prompt. */
  action: string;
  reviewer?: boolean | undefined;
  children: (me: Me) => ReactNode;
}

/**
 * Renders its children for a signed-in account. A guest gets a sign-in path
 * that comes back here, instead of a silent failure.
 */
export function RequireUser({
  action,
  reviewer = false,
  children,
}: RequireUserProps) {
  const session = useSession();

  if (session.status === 'unknown' || session.status === 'loading') {
    return (
      <p className={forms.status} role="status">
        Vérification de votre session…
      </p>
    );
  }

  if (session.status === 'guest') {
    return (
      <div className={forms.card}>
        <p className={forms.status}>Connectez-vous pour {action}.</p>
        <div className={forms.actions}>
          <Link to={signInPath(currentPath())} className={forms.primary}>
            Se connecter
          </Link>
          <Link to="/inscription" className={forms.secondary}>
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  if (reviewer && !isReviewer(session)) {
    return (
      <div className={forms.card} role="note">
        <p className={forms.status}>
          Cette page est réservée aux relecteurs. La permission de relecture est
          accordée par un opérateur de LOVA.
        </p>
      </div>
    );
  }

  return <>{children(session.me)}</>;
}
