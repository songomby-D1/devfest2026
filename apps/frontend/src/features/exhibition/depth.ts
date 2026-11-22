/*
 * The storyline is a corridor: chapter i stands i * SPACING metres deeper
 * than the first. Navigation moves a continuous "depth" value measured in
 * chapters; the camera follows it, and the active chapter is its rounding.
 */

/** Metres between two chapters along -z. */
export const SPACING = 8;
/** Distance between the camera and the chapter it faces. */
export const CAMERA_DISTANCE = 5.4;
/** How far one wheel pixel moves the target, in chapters. */
export const WHEEL_STEP = 0.0024;
/** How far one dragged pixel moves the target, in chapters. */
export const TOUCH_STEP = 0.0055;

export function clampDepth(depth: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, depth));
}

export function chapterAt(depth: number, count: number): number {
  return Math.round(clampDepth(depth, count));
}

/** Below this, a gesture is a nudge and the visitor stays on the chapter. */
export const SNAP_THRESHOLD = 0.15;

/**
 * Where a wheel or swipe gesture settles. It moves at least one chapter in
 * its direction once it passes the threshold, so a single wheel notch or a
 * slow trackpad stroke always advances instead of falling back.
 */
export function snapIndex(
  anchor: number,
  target: number,
  count: number,
): number {
  const delta = target - anchor;
  if (Math.abs(delta) < SNAP_THRESHOLD) return chapterAt(anchor, count);
  const chapters = Math.max(1, Math.round(Math.abs(delta)));
  return chapterAt(anchor + Math.sign(delta) * chapters, count);
}

/** 0 while the chapter is ahead or current, 1 once the camera is past it. */
export function sinkAmount(pastBy: number): number {
  const t = Math.min(1, Math.max(0, (pastBy - 0.04) * 2.4));
  return t * t * (3 - 2 * t);
}

/** z of chapter `index` in the scene. */
export function chapterZ(index: number): number {
  return -index * SPACING;
}

/** Distance from the entrance, as shown on the depth rail ("−16 m"). */
export function depthLabel(index: number): string {
  return index === 0 ? '0 m' : `−${String(index * SPACING)} m`;
}

/** Framerate-independent exponential smoothing toward `target`. */
export function damp(
  current: number,
  target: number,
  lambda: number,
  delta: number,
): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

/**
 * Lateral offset of the models. On a wide screen they stand right of centre
 * so the wall text on the left never covers them; on a narrow screen they
 * stand in the middle, above the text card.
 */
export function stageOffset(aspect: number): number {
  return aspect > 1.15 ? 1.05 : 0;
}

/** Keys that move along the storyline, in chapters. */
export function keyStep(key: string): number | 'first' | 'last' | null {
  switch (key) {
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      return 1;
    case 'ArrowUp':
    case 'PageUp':
      return -1;
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}
