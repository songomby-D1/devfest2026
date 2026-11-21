import { artworks } from './gallery-content';
import { clamp, nearestIndex } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, rail, railTo } from './gallery-store';

/*
 * Discrete navigation shared by the 3D controls, the DOM overlay and the
 * no-WebGL fallback: stepping from work to work, the keyboard map and the
 * deep links that open the visit inside the room.
 */

/**
 * `?salle` starts inside the room, `?oeuvre=<id>` opens that work's notice,
 * `&zoom=<n>` applies n zoom steps and `&inspect` turns a sculpture.
 * These are the future `/galerie` and `/oeuvre/:id` routes.
 */
export function applyDeepLink(
  placed: readonly PlacedArtwork[],
  search: string = window.location.search,
): void {
  const params = new URLSearchParams(search);
  const workId = params.get('oeuvre');
  if (!params.has('salle') && workId === null) {
    return;
  }
  galleryStore.enter();
  galleryStore.introDone();
  const index =
    workId === null ? -1 : artworks.findIndex((work) => work.id === workId);
  const work = index >= 0 ? placed[index] : undefined;
  if (!work) {
    return;
  }
  railTo(work.x);
  rail.current = rail.target;
  galleryStore.setActive(index);
  galleryStore.focus(index);
  const zoomSteps = Number.parseInt(params.get('zoom') ?? '0', 10);
  for (let step = 0; step < zoomSteps; step += 1) {
    galleryStore.zoomStep();
  }
  if (params.has('inspect')) {
    galleryStore.toggleInspect();
  }
}

export function stepWork(
  placed: readonly PlacedArtwork[],
  direction: 1 | -1,
): void {
  const state = galleryStore.getState();
  const last = placed.length - 1;
  if (last < 0) {
    return;
  }
  if (state.phase === 'visiting') {
    const current = nearestIndex(placed, rail.target);
    const next = clamp(current + direction, 0, last);
    const work = placed[next];
    if (work) {
      railTo(work.x);
      galleryStore.setActive(next);
    }
  } else if (state.phase === 'focus') {
    const next = clamp(
      (state.focusedIndex ?? state.activeIndex) + direction,
      0,
      last,
    );
    galleryStore.focus(next);
  }
}

export function goToWork(
  placed: readonly PlacedArtwork[],
  index: number,
): void {
  const work = placed[index];
  if (!work) {
    return;
  }
  if (galleryStore.getState().phase === 'focus') {
    galleryStore.unfocus();
  }
  railTo(work.x);
  galleryStore.setActive(index);
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
  );
}

export function handleGalleryKey(
  event: KeyboardEvent,
  placed: readonly PlacedArtwork[],
): void {
  const state = galleryStore.getState();
  if (state.phase !== 'visiting' && state.phase !== 'focus') {
    return;
  }
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      stepWork(placed, 1);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      stepWork(placed, -1);
      break;
    case 'Escape':
      if (state.phase === 'focus') {
        galleryStore.unfocus();
      }
      break;
    case 'Enter':
    case ' ':
      if (state.phase === 'visiting' && !isInteractive(event.target)) {
        event.preventDefault();
        galleryStore.focus(state.activeIndex);
      }
      break;
    case '+':
    case '=':
      galleryStore.zoomStep();
      break;
    case '-':
      galleryStore.zoomOut();
      break;
    default:
      break;
  }
}
