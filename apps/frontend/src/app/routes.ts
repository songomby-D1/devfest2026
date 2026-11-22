import type { Room } from '../features/gallery/data/rooms';
import { findRoom, roomPath, rooms } from '../features/gallery/data/rooms';

export type Route =
  | { kind: 'home' }
  | { kind: 'contribute' }
  | { kind: 'visit' }
  | { kind: 'gallery'; room: Room; artworkIndex: number | null }
  | { kind: 'redirect'; to: string }
  | { kind: 'not-found' };

/** Maps a pathname to a screen. `/musee` and `/musee/:room` redirect to the first artwork. */
export function matchRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  const [first, roomSlug, artworkNumber] = segments;

  if (first === undefined) {
    return { kind: 'home' };
  }
  if (first === 'contribuer' && segments.length === 1) {
    return { kind: 'contribute' };
  }
  // The WebGL room reads its own deep links from the query string.
  if (first === 'visite' && segments.length === 1) {
    return { kind: 'visit' };
  }
  if (first !== 'musee' || segments.length > 3) {
    return { kind: 'not-found' };
  }

  const room = roomSlug === undefined ? rooms[0] : findRoom(roomSlug);
  if (room === undefined) {
    return { kind: 'not-found' };
  }

  if (artworkNumber === undefined) {
    const target = roomPath(room);
    return target === pathname
      ? { kind: 'gallery', room, artworkIndex: null }
      : { kind: 'redirect', to: target };
  }

  const artworkIndex = room.artworks.findIndex(
    (artwork) => artwork.number === artworkNumber,
  );
  if (artworkIndex === -1) {
    return { kind: 'redirect', to: roomPath(room) };
  }
  return { kind: 'gallery', room, artworkIndex };
}
