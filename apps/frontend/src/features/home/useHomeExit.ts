import type { RefObject } from 'react';
import { useRef } from 'react';
import { markArrival } from '../../lib/motion/arrival';
import { gsap, useGSAP } from '../../lib/motion/gsap';
import type { SplitText } from '../../lib/motion/gsap';
import type { TransitionVariant } from '../../lib/motion/motion-prefs';

interface ExitOptions {
  variant: TransitionVariant;
  reducedMotion: boolean;
  splitRef: RefObject<SplitText | null>;
}

type Selector = (selector: string) => Element[];

/** Lines leave upward past the mask headroom. */
const LINE_EXIT = -150;

function headlineExit(
  tl: gsap.core.Timeline,
  q: Selector,
  split: SplitText | null,
  at: number,
): void {
  if (split === null) {
    tl.to(
      q('[data-anim="headline"]'),
      { autoAlpha: 0, duration: 0.4, ease: 'power1.in' },
      at,
    );
    return;
  }
  tl.to(
    split.lines,
    { yPercent: LINE_EXIT, duration: 0.6, ease: 'expo.in', stagger: 0.05 },
    at,
  );
}

/* Left elements leave left, right ones leave right, the headline lines rise
   behind their mask and the wall turns gallery black. About 1 s. */
function galleryBlack(
  tl: gsap.core.Timeline,
  q: Selector,
  split: SplitText | null,
): void {
  const distance = (): number => window.innerWidth * 0.5;
  tl.to(
    q('[data-anim="exhibit"][data-side="left"]'),
    {
      x: () => -distance(),
      autoAlpha: 0,
      duration: 0.85,
      ease: 'power3.in',
      stagger: 0.06,
    },
    0,
  );
  tl.to(
    q('[data-anim="exhibit"][data-side="right"]'),
    {
      x: () => distance(),
      autoAlpha: 0,
      duration: 0.85,
      ease: 'power3.in',
      stagger: 0.06,
    },
    0,
  );
  headlineExit(tl, q, split, 0.05);
  tl.to(
    q('[data-anim="nav"], [data-anim="description"], [data-anim="ctas"]'),
    { autoAlpha: 0, duration: 0.35, ease: 'power1.in' },
    0,
  );
  tl.to(
    q('[data-anim="blackout"]'),
    { autoAlpha: 1, duration: 0.55, ease: 'power2.inOut' },
    0.42,
  );
}

/* The left painting grows to fill the screen while the rest fades, then plunges to black. */
function throughFrame(
  tl: gsap.core.Timeline,
  q: Selector,
  split: SplitText | null,
): void {
  const frame = q(
    '[data-anim="exhibit"][data-kind="frame"][data-side="left"]',
  )[0];
  if (frame === undefined) {
    galleryBlack(tl, q, split);
    return;
  }
  const rect = frame.getBoundingClientRect();
  const scale =
    Math.max(window.innerWidth / rect.width, window.innerHeight / rect.height) *
    1.08;
  const others = q('[data-anim="exhibit"]').filter(
    (element) => element !== frame,
  );
  tl.to(
    [
      ...others,
      ...q('[data-anim="nav"], [data-anim="description"], [data-anim="ctas"]'),
    ],
    { autoAlpha: 0, duration: 0.4, ease: 'power2.in' },
    0,
  );
  headlineExit(tl, q, split, 0);
  tl.to(
    frame,
    {
      x: window.innerWidth / 2 - (rect.left + rect.width / 2),
      y: window.innerHeight / 2 - (rect.top + rect.height / 2),
      scale,
      duration: 1.05,
      ease: 'power4.inOut',
    },
    0.05,
  );
  tl.to(
    q('[data-anim="blackout"]'),
    { autoAlpha: 1, duration: 0.4, ease: 'power2.in' },
    0.7,
  );
}

/* A black panel rises from the bottom like a closing curtain. The gallery keeps it moving up. */
function curtain(
  tl: gsap.core.Timeline,
  q: Selector,
  split: SplitText | null,
): void {
  const blackout = q('[data-anim="blackout"]');
  tl.set(blackout, { autoAlpha: 1, yPercent: 100 }, 0);
  tl.to(blackout, { yPercent: 0, duration: 0.8, ease: 'power4.inOut' }, 0);
  headlineExit(tl, q, split, 0);
}

/**
 * Returns the exit played before "Entrer dans le musée" navigates. Repeated
 * clicks reuse the running exit. Reduced motion gets a 0.4 s fade to black.
 */
export function useHomeExit(
  rootRef: RefObject<HTMLElement | null>,
  { variant, reducedMotion, splitRef }: ExitOptions,
): () => Promise<void> {
  const { contextSafe } = useGSAP({ scope: rootRef });
  const runningRef = useRef<Promise<void> | null>(null);

  const play = contextSafe((resolve: () => void) => {
    const root = rootRef.current;
    if (root === null) {
      resolve();
      return;
    }
    root.dataset['motion'] = 'exiting';
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ onComplete: resolve });

    if (reducedMotion) {
      markArrival('fade');
      tl.to(q('[data-anim="blackout"]'), {
        autoAlpha: 1,
        duration: 0.4,
        ease: 'none',
      });
      return;
    }

    markArrival(variant);
    const split = splitRef.current;
    if (variant === 'through-frame') {
      throughFrame(tl, q, split);
    } else if (variant === 'curtain') {
      curtain(tl, q, split);
    } else {
      galleryBlack(tl, q, split);
    }
  });

  return () => {
    runningRef.current ??= new Promise<void>((resolve) => {
      play(resolve);
    });
    return runningRef.current;
  };
}
