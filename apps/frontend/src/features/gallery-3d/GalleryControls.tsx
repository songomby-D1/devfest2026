import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { PlacedArtwork } from './gallery-layout';
import { handleGalleryKey } from './gallery-navigation';
import { galleryStore, moveRail, spin } from './gallery-store';

interface GalleryControlsProps {
  readonly placed: readonly PlacedArtwork[];
}

/** Metres travelled per wheel pixel. */
const WHEEL_GAIN = 0.0045;
/** Metres travelled when dragging across the whole canvas width. */
const DRAG_SWEEP = 7.5;
/** Radians per second given to the inspected object per pixel of drag. */
const SPIN_GAIN = 0.25;

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

    const onWheel = (event: WheelEvent): void => {
      if (galleryStore.getState().phase !== 'visiting') {
        return;
      }
      event.preventDefault();
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      moveRail(delta * WHEEL_GAIN);
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      pointerId = event.pointerId;
      lastX = event.clientX;
      const state = galleryStore.getState();
      spin.dragging = state.phase === 'focus' && state.inspecting;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - lastX;
      lastX = event.clientX;
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
