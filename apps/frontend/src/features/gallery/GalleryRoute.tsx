import { useEffect, useMemo } from 'react';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import { Logo } from '../../components/logo/Logo';
import {
  loadCollection,
  useCollection,
} from '../../lib/collection/published-items';
import { Link } from '../../lib/router/Link';
import { navigate } from '../../lib/router/router';
import { buildRooms } from './data/collection';
import type { Room } from './data/rooms';
import { roomPath } from './data/rooms';
import { GalleryPage } from './GalleryPage';
import styles from './GalleryRoute.module.css';

export interface GalleryRouteProps {
  /** Room template from the URL. */
  room: Room;
  artworkNumber: string | null;
}

interface Resolution {
  room: Room;
  rooms: readonly Room[];
  artworkIndex: number | null;
  /** Canonical URL when the requested one is a bare room or an unknown number. */
  redirectTo: string | null;
}

function resolve(
  rooms: readonly Room[],
  slug: string,
  artworkNumber: string | null,
): Resolution | null {
  const room = rooms.find((candidate) => candidate.slug === slug);
  if (room === undefined) return null;
  if (room.artworks.length === 0) {
    return {
      room,
      rooms,
      artworkIndex: null,
      redirectTo: artworkNumber === null ? null : roomPath(room),
    };
  }
  const found = room.artworks.findIndex(
    (artwork) => artwork.number === artworkNumber,
  );
  // The first artwork shows at once while the URL is corrected, so the room keeps its transition.
  return found === -1
    ? { room, rooms, artworkIndex: 0, redirectTo: roomPath(room) }
    : { room, rooms, artworkIndex: found, redirectTo: null };
}

/**
 * Loads the published items from the gateway, hangs them in their rooms and
 * renders the gallery. The gallery stays mounted while moving between rooms,
 * so its transitions play as before.
 */
export function GalleryRoute({ room, artworkNumber }: GalleryRouteProps) {
  const collection = useCollection();
  const items = collection.status === 'ready' ? collection.items : null;
  const rooms = useMemo(
    () => (items === null ? null : buildRooms(items)),
    [items],
  );
  const resolution =
    rooms === null ? null : resolve(rooms, room.slug, artworkNumber);

  const redirectTo = resolution?.redirectTo ?? null;
  useEffect(() => {
    if (redirectTo !== null) {
      navigate(redirectTo, { replace: true });
    }
  }, [redirectTo]);

  if (collection.status === 'error') {
    return (
      <div className={styles.screen}>
        <Link
          to="/"
          className={styles.logo}
          aria-label="LOVA, retour à l’accueil"
        >
          <Logo />
        </Link>
        <main className={styles.body}>
          <h1 className={styles.title}>Le musée est momentanément fermé</h1>
          <ErrorNotice
            error={collection.error}
            onRetry={() => {
              void loadCollection();
            }}
            className={styles.error}
          />
        </main>
      </div>
    );
  }

  if (resolution === null) {
    return (
      <div className={styles.screen}>
        <main className={styles.body}>
          <h1 className="visually-hidden">Salle {room.name}</h1>
          <p className={styles.loading} role="status">
            Ouverture de la salle {room.name}…
          </p>
        </main>
      </div>
    );
  }

  return (
    <GalleryPage
      room={resolution.room}
      rooms={resolution.rooms}
      artworkIndex={resolution.artworkIndex}
    />
  );
}
