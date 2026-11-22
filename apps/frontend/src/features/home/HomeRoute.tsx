import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../../lib/collection/published-items';
import { buildRooms } from '../gallery/data/collection';
import { buildHomeExhibits } from './home-content';
import type { HomeExhibit } from './home-content';
import { HomePage } from './HomePage';
import styles from './HomePage.module.css';

/** How long the home waits for the collection before hanging empty frames. */
export const HOME_DATA_TIMEOUT_MS = 1500;

/**
 * Waits for the published collection, then mounts the home with its frames.
 * The home stays hidden until its intro anyway, so the wait reads as the same
 * blank wall; past the timeout, or on error, the home opens without frames.
 */
export function HomeRoute() {
  const collection = useCollection();
  const [timedOut, setTimedOut] = useState(false);
  const [hung, setHung] = useState<readonly HomeExhibit[] | null>(null);
  const items = collection.status === 'ready' ? collection.items : null;
  const exhibits = useMemo(
    () => (items === null ? null : buildHomeExhibits(buildRooms(items))),
    [items],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, HOME_DATA_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  // The hanging is fixed once the intro starts: late data never pops frames in.
  const ready =
    exhibits ?? (collection.status === 'error' || timedOut ? [] : null);
  useEffect(() => {
    if (hung === null && ready !== null) setHung(ready);
  }, [hung, ready]);

  if (hung === null) {
    return (
      <div className={styles.home} data-motion="pending" aria-busy="true" />
    );
  }
  return <HomePage exhibits={hung} />;
}
