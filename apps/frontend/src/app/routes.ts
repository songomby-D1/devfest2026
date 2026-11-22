import type { Room } from '../features/gallery/data/rooms';
import { findRoom, rooms } from '../features/gallery/data/rooms';

export type Route =
  | { kind: 'home' }
  | { kind: 'sign-in' }
  | { kind: 'register' }
  | { kind: 'contribute' }
  | { kind: 'submission'; id: string }
  | { kind: 'my-submissions' }
  | { kind: 'item'; id: string }
  | { kind: 'review-queue' }
  | { kind: 'review'; id: string }
  | { kind: 'visit' }
  /** A narrated exhibition travelled in depth: `/expositions/:id`. */
  | { kind: 'exhibition'; id: string }
  /** `room` is the room template; its artworks load from the API in GalleryRoute. */
  | { kind: 'gallery'; room: Room; artworkNumber: string | null }
  | { kind: 'redirect'; to: string }
  | { kind: 'not-found' };

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Single-segment pages. */
const PAGES: Record<string, Route> = {
  connexion: { kind: 'sign-in' },
  inscription: { kind: 'register' },
  contribuer: { kind: 'contribute' },
  'mes-depots': { kind: 'my-submissions' },
  revue: { kind: 'review-queue' },
  // The WebGL room reads its own deep links from the query string.
  visite: { kind: 'visit' },
};

/** Pages of one item: `/oeuvre/:id`, `/contribuer/:id`, `/revue/:id`. */
const ITEM_PAGES = {
  oeuvre: 'item',
  contribuer: 'submission',
  revue: 'review',
} as const;

/**
 * Maps a pathname to a screen. `/musee` redirects to the first room; a room
 * and its artwork number are resolved against the API by GalleryRoute.
 */
export function matchRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  const [first, second, third] = segments;

  if (first === undefined) {
    return { kind: 'home' };
  }
  if (segments.length === 1 && Object.hasOwn(PAGES, first)) {
    return PAGES[first] ?? { kind: 'not-found' };
  }
  if (
    segments.length === 2 &&
    second !== undefined &&
    Object.hasOwn(ITEM_PAGES, first)
  ) {
    const id = decode(second);
    if (id === null || id === '') return { kind: 'not-found' };
    return { kind: ITEM_PAGES[first as keyof typeof ITEM_PAGES], id };
  }
  if (first === 'expositions' && segments.length <= 2) {
    if (second === undefined) return { kind: 'redirect', to: '/expositions/1' };
    const id = decode(second);
    return id === null || id === ''
      ? { kind: 'not-found' }
      : { kind: 'exhibition', id };
  }
  if (first !== 'musee' || segments.length > 3) {
    return { kind: 'not-found' };
  }

  if (second === undefined) {
    const firstRoom = rooms[0];
    return firstRoom === undefined
      ? { kind: 'not-found' }
      : { kind: 'redirect', to: `/musee/${firstRoom.slug}` };
  }
  const room = findRoom(second);
  if (room === undefined) {
    return { kind: 'not-found' };
  }
  return { kind: 'gallery', room, artworkNumber: third ?? null };
}
