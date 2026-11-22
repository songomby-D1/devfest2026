import { act } from '@testing-library/react';
import { gsap } from '../lib/motion/gsap';

/**
 * Lets pending font loads resolve, then jumps every GSAP animation to its end.
 * Content stays hidden until its animation starts and jsdom never ticks, so
 * tests settle motion before querying the page.
 */
export async function settleMotion(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  act(() => {
    for (const animation of gsap.globalTimeline.getChildren(true, true, true)) {
      animation.progress(1);
    }
  });
}
