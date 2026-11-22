import styles from './NotFoundPage.module.css';

export interface NotFoundPageProps {
  title?: string | undefined;
}

/** The same page for a missing path, a missing item and an item the visitor may not see. */
export function NotFoundPage({
  title = 'Page introuvable',
}: NotFoundPageProps) {
  return (
    <main className={styles.notFound}>
      <h1>{title}</h1>
      <p>
        <a href="/">Retour à l’accueil</a>
      </p>
    </main>
  );
}
