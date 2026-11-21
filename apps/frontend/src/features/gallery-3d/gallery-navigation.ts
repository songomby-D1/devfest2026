import { clamp, nearestIndex } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, rail, railTo } from './gallery-store';

/*
 * Discrete navigation shared by the 3D controls, the DOM overlay and the
 * no-WebGL fallback: stepping from work to work and the keyboard map.
 */

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
