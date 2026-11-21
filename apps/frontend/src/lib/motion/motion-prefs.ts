import { useSyncExternalStore } from 'react';

/*
 * Motion variants compared in the development motion lab. Production builds
 * always use the defaults. Remove the unused variants once Sesedra picks one.
 */

export type IntroVariant = 'hanging' | 'light' | 'focus';
export type TransitionVariant = 'gallery-black' | 'through-frame' | 'curtain';

export interface MotionPrefs {
  intro: IntroVariant;
  transition: TransitionVariant;
}

export const introVariants: readonly IntroVariant[] = [
  'hanging',
  'light',
  'focus',
];
export const transitionVariants: readonly TransitionVariant[] = [
  'gallery-black',
  'through-frame',
  'curtain',
];

const DEFAULT_PREFS: MotionPrefs = {
  intro: 'hanging',
  transition: 'gallery-black',
};
const STORAGE_KEY = 'lova.motion-lab';

type Listener = () => void;

const listeners = new Set<Listener>();
let prefs: MotionPrefs = readStoredPrefs();

function isIntroVariant(value: unknown): value is IntroVariant {
  return introVariants.some((variant) => variant === value);
}

function isTransitionVariant(value: unknown): value is TransitionVariant {
  return transitionVariants.some((variant) => variant === value);
}

function readStoredPrefs(): MotionPrefs {
  if (!import.meta.env.DEV) {
    return DEFAULT_PREFS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_PREFS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PREFS;
    }
    const intro = 'intro' in parsed ? parsed.intro : undefined;
    const transition = 'transition' in parsed ? parsed.transition : undefined;
    return {
      intro: isIntroVariant(intro) ? intro : DEFAULT_PREFS.intro,
      transition: isTransitionVariant(transition)
        ? transition
        : DEFAULT_PREFS.transition,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function getMotionPrefs(): MotionPrefs {
  return prefs;
}

export function setMotionPrefs(next: Partial<MotionPrefs>): void {
  prefs = { ...prefs, ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable in private windows. The choice still applies.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMotionPrefs(): MotionPrefs {
  return useSyncExternalStore(subscribe, getMotionPrefs, () => DEFAULT_PREFS);
}
