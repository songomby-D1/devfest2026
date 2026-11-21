import { useSyncExternalStore } from 'react';

/*
 * A minimal router on the History API. The app has a handful of routes, so the
 * platform covers deep links and the back button without a routing dependency.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  if (listeners.size === 0) {
    window.addEventListener('popstate', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('popstate', notify);
    }
  };
}

function getPath(): string {
  return window.location.pathname;
}

export interface NavigateOptions {
  replace?: boolean | undefined;
}

export function navigate(path: string, options: NavigateOptions = {}): void {
  if (options.replace === true) {
    window.history.replaceState(null, '', path);
  } else if (path !== window.location.pathname) {
    window.history.pushState(null, '', path);
  }
  notify();
}

export function useLocationPath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/');
}
