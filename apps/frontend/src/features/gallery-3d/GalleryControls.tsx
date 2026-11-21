import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ROOM, clamp, nearestIndex } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';
import { handleGalleryKey } from './gallery-navigation';
import { galleryStore, moveRail, rail, railTo, spin } from './gallery-store';

interface GalleryControlsProps {
  readonly placed: readonly PlacedArtwork[];
}

/** Metres travelled per wheel pixel. */
const WHEEL_GAIN = 0.0045;
/** Metres travelled when dragging across the whole canvas width. */
const DRAG_SWEEP = 7.5;
/** Radians per second given to the inspected object per pixel of drag. */
const SPIN_GAIN = 0.25;
/** Idle time after the last wheel tick before settling on a work. */
const SNAP_DELAY_MS = 320;
/** Fraction of the spacing a gesture must cover to move to the next work. */
const STEP_THRESHOLD = 0.12;

/**
 * Where a gesture ends: from the work it started on, one step per spacing
 * travelled in its direction, and at least one step past the threshold.
 * A slow mouse wheel therefore advances notch by notch instead of being
 * pulled back, while a long swipe skips several works.
 */
export function settleIndex(
  placed: readonly PlacedArtwork[],
  anchorIndex: number,
  targetX: number,
): number {
  const anchor = placed[anchorIndex];
  if (!anchor) {
    return nearestIndex(placed, targetX);
  }
  const travelled = targetX - anchor.x;
  const progress = Math.abs(travelled) / ROOM.spacing;
  if (progress < STEP_THRESHOLD) {
    return anchorIndex;
  }
  const steps = Math.max(1, Math.round(progress));
  return clamp(
    anchorIndex + Math.sign(travelled) * steps,
    0,
    placed.length - 1,
  );
}

/**
 * Input for the visit: wheel, drag and keyboard move the rail; in
 * inspection mode the same drag turns the sculpture instead. Listeners
 * are attached to the canvas and removed with it.
 */
export function GalleryControls({ placed }: GalleryControlsProps) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const element = gl.domElement;
    let pointerId: number | null = null;
    let lastX = 0;
    let dragged = false;
    let wheelTimer: number | null = null;
    let anchorIndex = 0;

    const beginGesture = (): void => {
      anchorIndex = nearestIndex(placed, rail.target);
    };

    /** Settles the visitor in front of a work once the gesture ends. */
    const settle = (): void => {
      wheelTimer = null;
      if (galleryStore.getState().phase !== 'visiting') {
        return;
      }
      const index = settleIndex(placed, anchorIndex, rail.target);
      const work = placed[index];
      if (work) {
        railTo(work.x);
        galleryStore.setActive(index);
      }
    };

    const onWheel = (event: WheelEvent): void => {
      if (galleryStore.getState().phase !== 'visiting') {
        return;
      }
      event.preventDefault();
      if (wheelTimer === null) {
        beginGesture();
      } else {
        window.clearTimeout(wheelTimer);
      }
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      moveRail(delta * WHEEL_GAIN);
      wheelTimer = window.setTimeout(settle, SNAP_DELAY_MS);
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      pointerId = event.pointerId;
      lastX = event.clientX;
      dragged = false;
      const state = galleryStore.getState();
      spin.dragging = state.phase === 'focus' && state.inspecting;
      if (state.phase === 'visiting') {
        beginGesture();
      }
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      if (dx !== 0) {
        dragged = true;
      }
      const state = galleryStore.getState();
      if (state.phase === 'visiting') {
        moveRail((-dx / Math.max(element.clientWidth, 1)) * DRAG_SWEEP);
      } else if (state.phase === 'focus' && state.inspecting) {
        spin.velocity = dx * SPIN_GAIN;
      }
    };

    const release = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) {
        return;
      }
      pointerId = null;
      spin.dragging = false;
      if (dragged) {
        settle();
      }
    };

    const onKey = (event: KeyboardEvent): void => {
      handleGalleryKey(event, placed);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', onKey);
    return () => {
      if (wheelTimer !== null) {
        window.clearTimeout(wheelTimer);
      }
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onKey);
    };
  }, [gl, placed]);

  return null;
}
