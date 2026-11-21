import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { SwapDirection } from './useArtworkSwap';

const MIN_DISTANCE = 48;
const MAX_OFF_AXIS = 60;

/** Horizontal swipe on touch screens, which navigates artworks. */
export function useSwipe(
  targetRef: RefObject<HTMLElement | null>,
  onSwipe: (direction: SwapDirection) => void,
): void {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const target = targetRef.current;
    if (target === null) {
      return;
    }
    let start: { x: number; y: number; id: number } | null = null;

    const handleDown = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') {
        start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      }
    };
    const handleUp = (event: PointerEvent): void => {
      if (start === null || event.pointerId !== start.id) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) >= MIN_DISTANCE && Math.abs(dy) <= MAX_OFF_AXIS) {
        onSwipeRef.current(dx < 0 ? 1 : -1);
      }
    };
    const handleCancel = (): void => {
      start = null;
    };

    target.addEventListener('pointerdown', handleDown);
    target.addEventListener('pointerup', handleUp);
    target.addEventListener('pointercancel', handleCancel);
    return () => {
      target.removeEventListener('pointerdown', handleDown);
      target.removeEventListener('pointerup', handleUp);
      target.removeEventListener('pointercancel', handleCancel);
    };
  }, [targetRef]);
}
