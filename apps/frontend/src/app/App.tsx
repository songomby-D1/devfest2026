import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.brand}>LOVA</p>
      </header>
      <main className={styles.main}>
        <h1>L’art malagasy, à portée de regard.</h1>
        <p className={styles.lead}>
          Peintures, sculptures, savoir-faire et musiques de Madagascar, à
          parcourir comme un véritable musée.
        </p>
      </main>
    </div>
  );
}
