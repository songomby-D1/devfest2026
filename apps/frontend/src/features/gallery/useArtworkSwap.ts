import type { RefObject } from 'react';
import { useRef } from 'react';
import { gsap, useGSAP } from '../../lib/motion/gsap';

export type SwapDirection = 1 | -1;

interface SwapOptions {
  reducedMotion: boolean;
  /** Swaps the rendered artwork. Runs when the outgoing one is hidden. */
  onSwap: (direction: SwapDirection) => void;
}

/**
 * Artwork change: the spot dims, the outgoing artwork slides a little in the
 * navigation direction and fades, the new one arrives from the opposite side
 * and the spot comes back. About 0.9 s. A rapid click interrupts the running
 * swap cleanly: the current one jumps to its end and the next starts from
 * there, so no state is ever stuck.
 */
export function useArtworkSwap(
  rootRef: RefObject<HTMLElement | null>,
  { reducedMotion, onSwap }: SwapOptions,
): (direction: SwapDirection) => void {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  const { contextSafe } = useGSAP({ scope: rootRef });

  return contextSafe((direction: SwapDirection) => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    timelineRef.current?.progress(1).kill();
    const q = gsap.utils.selector(root);
    const artwork = q('[data-g="artwork"]');
    const cartel = q('[data-g="cartel"]');
    const spot = q('[data-g="spot"]');
    const shift = 28 * direction;

    const tl = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null;
      },
    });
    timelineRef.current = tl;

    if (reducedMotion) {
      tl.to([artwork, cartel], { autoAlpha: 0, duration: 0.18, ease: 'none' })
        .call(() => {
          onSwapRef.current(direction);
        })
        .to([artwork, cartel], { autoAlpha: 1, duration: 0.22, ease: 'none' });
      return;
    }

    tl.to(spot, { autoAlpha: 0.35, duration: 0.3, ease: 'power2.in' }, 0)
      .to(
        artwork,
        { x: -shift, autoAlpha: 0, duration: 0.32, ease: 'power2.in' },
        0,
      )
      .to(cartel, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' }, 0)
      .call(() => {
        onSwapRef.current(direction);
      })
      .fromTo(
        artwork,
        { x: shift, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' },
      )
      .to(spot, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, '<')
      .fromTo(
        cartel,
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '<0.1',
      );
  });
}
