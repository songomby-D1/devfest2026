import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

type Listener = () => void;

const listeners = new Set<Listener>();
let forced: boolean | null = null;

function mediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** True when the visitor asks for reduced motion, or the motion lab forces it. */
export function prefersReducedMotion(): boolean {
  if (forced !== null) {
    return forced;
  }
  return mediaQuery()?.matches ?? false;
}

/** Used by the development motion lab only. `null` follows the system setting. */
export function setForcedReducedMotion(value: boolean | null): void {
  forced = value;
  notify();
}

function subscribe(listener: Listener): () => void {
  const query = mediaQuery();
  query?.addEventListener('change', listener);
  listeners.add(listener);
  return () => {
    query?.removeEventListener('change', listener);
    listeners.delete(listener);
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
