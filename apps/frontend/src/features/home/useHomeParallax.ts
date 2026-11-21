import type { RefObject } from 'react';
import { gsap, useGSAP } from '../../lib/motion/gsap';

const MAX_X = 20;
const MAX_Y = 14;

/**
 * Light cursor parallax after the intro. Mouse only (never touch), up to about
 * 20 px, a different depth per element, smoothed with quickTo. It moves only
 * the [data-parallax] layers, so it never fights the intro or exit transforms
 * on the figures.
 */
export function useHomeParallax(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!enabled || root === null) {
        return;
      }
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return;
      }

      const movers = gsap.utils
        .toArray<HTMLElement>('[data-anim="exhibit"]', root)
        .map((exhibit) => {
          const depth = Number(exhibit.dataset.depth ?? '1');
          const layers = exhibit.querySelectorAll('[data-parallax]');
          return {
            depth,
            x: gsap.quickTo(layers, 'x', { duration: 0.9, ease: 'power3.out' }),
            y: gsap.quickTo(layers, 'y', { duration: 0.9, ease: 'power3.out' }),
          };
        });

      const moveTo = (nx: number, ny: number): void => {
        for (const mover of movers) {
          mover.x(nx * MAX_X * mover.depth);
          mover.y(ny * MAX_Y * mover.depth);
        }
      };

      const handlePointerMove = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse') {
          return;
        }
        moveTo(
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1,
        );
      };
      const handleLeave = (): void => {
        moveTo(0, 0);
      };

      window.addEventListener('pointermove', handlePointerMove);
      document.documentElement.addEventListener('mouseleave', handleLeave);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        document.documentElement.removeEventListener('mouseleave', handleLeave);
      };
    },
    { scope: rootRef, dependencies: [enabled], revertOnUpdate: true },
  );
}
