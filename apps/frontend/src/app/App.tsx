import { lazy, Suspense, useEffect } from 'react';
import { NotFoundPage } from '../components/not-found/NotFoundPage';
import { RegisterPage } from '../features/account/RegisterPage';
import { SignInPage } from '../features/account/SignInPage';
import { ContributePage } from '../features/contribute/ContributePage';
import { MySubmissionsPage } from '../features/contribute/MySubmissionsPage';
import { SubmissionPage } from '../features/contribute/SubmissionPage';
import { GalleryRoute } from '../features/gallery/GalleryRoute';
import { HomeRoute } from '../features/home/HomeRoute';
import { ItemPage } from '../features/item/ItemPage';
import { ReviewItemPage } from '../features/review/ReviewItemPage';
import { ReviewQueuePage } from '../features/review/ReviewQueuePage';
import { ambience } from '../lib/audio/ambience';
import { navigate, useLocationPath } from '../lib/router/router';
import { matchRoute } from './routes';

// Loaded on demand so three and React Three Fiber stay out of the main bundle.
const GalleryExperience = lazy(() =>
  import('../features/gallery-3d').then((module) => ({
    default: module.GalleryExperience,
  })),
);

// The exhibition carries its own WebGL corridor: loaded on demand too.
const ExhibitionPage = lazy(() =>
  import('../features/exhibition').then((module) => ({
    default: module.ExhibitionPage,
  })),
);

const MotionLab = lazy(() =>
  import('./MotionLab').then((module) => ({ default: module.MotionLab })),
);

function showMotionLab(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('motion') === 'lab'
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
      return <HomeRoute />;
    case 'sign-in':
      return <SignInPage />;
    case 'register':
      return <RegisterPage />;
    case 'contribute':
      return <ContributePage />;
    case 'submission':
      return <SubmissionPage key={route.id} id={route.id} />;
    case 'my-submissions':
      return <MySubmissionsPage />;
    case 'item':
      return <ItemPage key={route.id} id={route.id} />;
    case 'review-queue':
      return <ReviewQueuePage />;
    case 'review':
      return <ReviewItemPage key={route.id} id={route.id} />;
    case 'visit':
      return (
        <Suspense fallback={null}>
          <GalleryExperience />
        </Suspense>
      );
    case 'exhibition':
      return (
        <Suspense fallback={null}>
          <ExhibitionPage key={route.id} id={route.id} />
        </Suspense>
      );
    case 'gallery':
      return (
        <GalleryRoute room={route.room} artworkNumber={route.artworkNumber} />
      );
    case 'redirect':
      return null;
    case 'not-found':
      return <NotFoundPage />;
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
