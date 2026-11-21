import { useSyncExternalStore } from 'react';
import { ZOOM_LEVELS } from './gallery-layout';

/*
 * The visit is a small, deterministic state machine:
 *
 *   entrance --enter()--> entering --introDone()--> visiting
 *   visiting --focus(i)--> focus --unfocus()--> visiting
 *
 * Continuous values that change every frame (the rail position and the
 * inspection spin) live outside React state, in `rail` and `spin`, so the
 * 3D loop never triggers renders. The store only holds discrete UI state.
 */

export type GalleryPhase = 'entrance' | 'entering' | 'visiting' | 'focus';

export type MediaStatus = 'loading' | 'ready' | 'missing';

export interface GalleryState {
  readonly phase: GalleryPhase;
  /** Index of the work in front of the visitor. */
  readonly activeIndex: number;
  readonly focusedIndex: number | null;
  readonly hoveredIndex: number | null;
  /** Index into ZOOM_LEVELS, only meaningful in focus. */
  readonly zoomLevel: number;
  /** Rotation mode for a focused sculpture. */
  readonly inspecting: boolean;
  /** When the intro started, from performance.now(), or null before it. */
  readonly introStartedAt: number | null;
  readonly media: Readonly<Record<string, MediaStatus>>;
}

type Listener = () => void;

const INITIAL_STATE: GalleryState = {
  phase: 'entrance',
  activeIndex: 0,
  focusedIndex: null,
  hoveredIndex: null,
  zoomLevel: 0,
  inspecting: false,
  introStartedAt: null,
  media: {},
};

const listeners = new Set<Listener>();
let state: GalleryState = INITIAL_STATE;

function setState(patch: Partial<GalleryState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

/** Visitor position along the wall, in metres. Mutated by controls, read by the frame loop. */
export const rail = { target: 0, current: 0, min: 0, max: 0 };

/** Pointer-driven rotation of the inspected sculpture, in radians. */
export const spin = { velocity: 0, dragging: false };

export function setRailBounds(min: number, max: number): void {
  rail.min = min;
  rail.max = max;
  rail.target = Math.min(max, Math.max(min, rail.target));
  rail.current = Math.min(max, Math.max(min, rail.current));
}

export function moveRail(delta: number): void {
  rail.target = Math.min(rail.max, Math.max(rail.min, rail.target + delta));
}

export function railTo(x: number): void {
  rail.target = Math.min(rail.max, Math.max(rail.min, x));
}

function getState(): GalleryState {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const galleryStore = {
  getState,
  subscribe,

  /** Leaves the entrance screen and starts the travelling. */
  enter(now: number = performance.now()): void {
    if (state.phase !== 'entrance') {
      return;
    }
    setState({ phase: 'entering', introStartedAt: now });
  },

  introDone(): void {
    if (state.phase !== 'entering') {
      return;
    }
    setState({ phase: 'visiting' });
  },

  setActive(index: number): void {
    if (state.activeIndex !== index) {
      setState({ activeIndex: index });
    }
  },

  setHovered(index: number | null): void {
    if (state.hoveredIndex !== index) {
      setState({ hoveredIndex: index });
    }
  },

  focus(index: number): void {
    if (state.phase !== 'visiting' && state.phase !== 'focus') {
      return;
    }
    spin.velocity = 0;
    setState({
      phase: 'focus',
      focusedIndex: index,
      activeIndex: index,
      zoomLevel: 0,
      inspecting: false,
      hoveredIndex: null,
    });
  },

  unfocus(): void {
    if (state.phase !== 'focus') {
      return;
    }
    spin.velocity = 0;
    setState({
      phase: 'visiting',
      focusedIndex: null,
      zoomLevel: 0,
      inspecting: false,
    });
  },

  /** Cycles through the zoom levels and back to the first one. */
  zoomStep(): void {
    if (state.phase !== 'focus') {
      return;
    }
    setState({ zoomLevel: (state.zoomLevel + 1) % ZOOM_LEVELS.length });
  },

  zoomOut(): void {
    if (state.phase !== 'focus' || state.zoomLevel === 0) {
      return;
    }
    setState({ zoomLevel: state.zoomLevel - 1 });
  },

  toggleInspect(): void {
    if (state.phase !== 'focus') {
      return;
    }
    spin.velocity = 0;
    setState({ inspecting: !state.inspecting });
  },

  setMediaStatus(id: string, status: MediaStatus): void {
    if (state.media[id] === status) {
      return;
    }
    setState({ media: { ...state.media, [id]: status } });
  },

  /** Back to the entrance screen, keeping the loaded media. */
  leave(): void {
    spin.velocity = 0;
    setState({ ...INITIAL_STATE, media: state.media });
  },

  /** Full reset, for tests. */
  reset(): void {
    rail.target = 0;
    rail.current = 0;
    rail.min = 0;
    rail.max = 0;
    spin.velocity = 0;
    spin.dragging = false;
    state = INITIAL_STATE;
    for (const listener of listeners) {
      listener();
    }
  },
};

export function useGallery(): GalleryState {
  return useSyncExternalStore(subscribe, getState, () => INITIAL_STATE);
}

export function currentZoom(zoomLevel: number): number {
  return ZOOM_LEVELS[zoomLevel] ?? 1;
}
