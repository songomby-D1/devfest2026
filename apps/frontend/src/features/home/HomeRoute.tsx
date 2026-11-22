import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../../lib/collection/published-items';
import { buildRooms } from '../gallery/data/collection';
import type { Room } from '../gallery/data/rooms';
import { buildHomeExhibits } from './home-content';
import type { HomeExhibit } from './home-content';
import { HomePage } from './HomePage';
import styles from './HomePage.module.css';
import type { FriezePiece } from './sections/ArtFrieze';

/** Every published work, room by room, for the frieze. */
function buildFriezePieces(rooms: readonly Room[]): FriezePiece[] {
  return rooms.flatMap((room) =>
    room.artworks.map((artwork) => ({
      id: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      technique: artwork.technique,
      period: artwork.year,
      room: room.name,
      story: artwork.story[0] ?? '',
      image: artwork.image,
      alt: artwork.alt,
    })),
  );
}

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
  const rooms = useMemo(
    () => (items === null ? null : buildRooms(items)),
    [items],
  );
  const exhibits = useMemo(
    () => (rooms === null ? null : buildHomeExhibits(rooms)),
    [rooms],
  );
  const pieces = useMemo(
    () => (rooms === null ? [] : buildFriezePieces(rooms)),
    [rooms],
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
  const failed = collection.status === 'error';
  useEffect(() => {
    if (hung !== null) return;
    const ready = exhibits ?? (failed || timedOut ? [] : null);
    if (ready !== null) setHung(ready);
  }, [hung, exhibits, failed, timedOut]);

  if (hung === null) {
    return (
      <div className={styles.home} data-motion="pending" aria-busy="true" />
    );
  }
  return <HomePage exhibits={hung} pieces={pieces} />;
}
