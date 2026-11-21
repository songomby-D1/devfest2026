import { lazy, Suspense, useEffect } from 'react';
import { ContributePage } from '../features/contribute/ContributePage';
import { GalleryPage } from '../features/gallery/GalleryPage';
import { HomePage } from '../features/home/HomePage';
import { ambience } from '../lib/audio/ambience';
import { navigate, useLocationPath } from '../lib/router/router';
import { matchRoute } from './routes';
import styles from './App.module.css';

const MotionLab = lazy(() =>
  import('./MotionLab').then((module) => ({ default: module.MotionLab })),
);

function showMotionLab(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('motion') === 'lab'
  );
}

function NotFound() {
  return (
    <main className={styles.notFound}>
      <h1>Page introuvable</h1>
      <p>
        <a href="/">Retour à l’accueil</a>
      </p>
    </main>
  );
}

function Screen({ pathname }: { pathname: string }) {
  const route = matchRoute(pathname);

  useEffect(() => {
    if (route.kind === 'redirect') {
      navigate(route.to, { replace: true });
    }
  }, [route]);

  switch (route.kind) {
    case 'home':
      return <HomePage />;
    case 'contribute':
      return <ContributePage />;
    case 'gallery':
      return (
        <GalleryPage room={route.room} artworkIndex={route.artworkIndex} />
      );
    case 'redirect':
      return null;
    case 'not-found':
      return <NotFound />;
  }
}

export function App() {
  const pathname = useLocationPath();

  useEffect(
    () => () => {
      ambience.reset();
    },
    [],
  );

  return (
    <>
      <Screen pathname={pathname} />
      {showMotionLab() && (
        <Suspense fallback={null}>
          <MotionLab />
        </Suspense>
      )}
    </>
  );
}
