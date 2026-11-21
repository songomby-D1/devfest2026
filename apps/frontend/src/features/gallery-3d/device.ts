/*
 * Capability checks run once, at mount, so the experience picks the right
 * renderer and budget before the first frame.
 */

export type RendererSupport = 'webgl' | 'none';

export interface DeviceProfile {
  readonly renderer: RendererSupport;
  /** Phones and small tablets get a lighter scene. */
  readonly lowPower: boolean;
  readonly reducedMotion: boolean;
}

function hasWebGl(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return context !== null;
  } catch {
    return false;
  }
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}

export function detectDevice(): DeviceProfile {
  const coarsePointer = matches('(pointer: coarse)');
  const narrow = matches('(max-width: 900px)');
  const hardwareThreads =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 8;
  return {
    renderer: hasWebGl() ? 'webgl' : 'none',
    lowPower: (coarsePointer && narrow) || hardwareThreads <= 4,
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
  };
}
