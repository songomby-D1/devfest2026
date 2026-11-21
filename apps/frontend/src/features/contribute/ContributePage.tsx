import { ButtonLink } from '../../components/button-link/ButtonLink';
import { Logo } from '../../components/logo/Logo';
import { Link } from '../../lib/router/Link';
import styles from './ContributePage.module.css';

/** Placeholder for "Déposer une œuvre" until the contribution flow (FE-03) lands. */
export function ContributePage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link to="/" aria-label="LOVA, accueil">
          <Logo />
        </Link>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>Déposer une œuvre</h1>
        <p className={styles.text}>
          Le dépôt d’œuvres ouvrira avec l’espace contributeur. Il permettra de
          décrire une œuvre, d’ajouter ses médias et de suivre sa relecture.
        </p>
        <ButtonLink to="/" variant="secondary">
          Retour à l’accueil
        </ButtonLink>
      </main>
    </div>
  );
}
