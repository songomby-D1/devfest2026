import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chapterAt,
  clampDepth,
  keyStep,
  snapIndex,
  TOUCH_STEP,
  WHEEL_STEP,
} from './depth';

/** Shared with the 3D scene, which reads it every frame without re-rendering. */
export interface DepthState {
  /** Where the visitor is heading, in chapters. */
  target: number;
  /** Where the camera is now, eased toward `target` by the scene. */
  current: number;
}

/** After this pause in wheel or touch input, the target settles on the nearest chapter. */
const SNAP_DELAY_MS = 180;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export interface DepthNavigation {
  readonly index: number;
  readonly depth: DepthState;
  goTo: (index: number) => void;
  step: (delta: number) => void;
}

/**
 * Wheel, vertical swipe and arrow keys move the visitor deeper into the
 * storyline (down) or back toward the entrance (up), never sideways.
 * `enabled` is false while a panel is open, so its own scrolling wins.
 */
export function useDepthNavigation(
  count: number,
  initialIndex: number,
  enabled: boolean,
): DepthNavigation {
  const depth = useRef<DepthState>({
    target: clampDepth(initialIndex, count),
    current: clampDepth(initialIndex, count),
  }).current;
  const [index, setIndex] = useState(() => chapterAt(initialIndex, count));
  const snapTimer = useRef<number | undefined>(undefined);
  const countRef = useRef(count);
  countRef.current = count;

  const setTarget = useCallback(
    (value: number) => {
      depth.target = clampDepth(value, countRef.current);
      setIndex(chapterAt(depth.target, countRef.current));
    },
    [depth],
  );

  const goTo = useCallback(
    (next: number) => {
      window.clearTimeout(snapTimer.current);
      setTarget(Math.round(next));
    },
    [setTarget],
  );

  const step = useCallback(
    (delta: number) => {
      goTo(chapterAt(depth.target, countRef.current) + delta);
    },
    [depth, goTo],
  );

  // A new chapter appended at the end keeps the visitor where they are.
  useEffect(() => {
    setTarget(depth.target);
  }, [count, depth, setTarget]);

  useEffect(() => {
    if (!enabled) return undefined;

    // The chapter a gesture started from; null between gestures.
    let anchor: number | null = null;
    const beginGesture = (): void => {
      anchor ??= chapterAt(depth.target, countRef.current);
    };
    const scheduleSnap = (): void => {
      window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        const from = anchor ?? chapterAt(depth.target, countRef.current);
        anchor = null;
        setTarget(snapIndex(from, depth.target, countRef.current));
      }, SNAP_DELAY_MS);
    };

    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey) return; // pinch-zoom on trackpads
      event.preventDefault();
      beginGesture();
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 32
          : event.deltaY;
      setTarget(depth.target + pixels * WHEEL_STEP);
      scheduleSnap();
    };

    let lastY: number | null = null;
    const onTouchStart = (event: TouchEvent): void => {
      lastY = event.touches[0]?.clientY ?? null;
      beginGesture();
    };
    const onTouchMove = (event: TouchEvent): void => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || lastY === null) return;
      // Dragging up moves forward, like scrolling a page down.
      setTarget(depth.target + (lastY - y) * TOUCH_STEP);
      lastY = y;
      event.preventDefault();
    };
    const onTouchEnd = (): void => {
      lastY = null;
      scheduleSnap();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTyping(event.target)) return;
      // Space on a focused button presses it instead.
      if (event.key === ' ' && event.target instanceof HTMLButtonElement) {
        return;
      }
      const move = keyStep(event.key);
      if (move === null) return;
      event.preventDefault();
      if (move === 'first') goTo(0);
      else if (move === 'last') goTo(countRef.current - 1);
      else goTo(chapterAt(depth.target, countRef.current) + move);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(snapTimer.current);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, depth, goTo, setTarget]);

  return { index, depth, goTo, step };
}
