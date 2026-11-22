import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { takeArrival } from '../../lib/motion/arrival';
import { waitForFonts } from '../../lib/motion/fonts';
import { gsap, SplitText, useGSAP } from '../../lib/motion/gsap';

const GALLERY_FONTS = [
  '700 80px "TikTok Sans"',
  '400 16px "TikTok Sans"',
  '400 14px "Departure Mono"',
];

/** Room elements lit by the arrival sequence. Bars only on the first arrival. */
const ROOM_TARGETS =
  '[data-g="scene"], [data-g="spot"], [data-g="hung"], [data-g="placeholder"], [data-g="cartel"], [data-g="wall-label"], [data-g="wall-title"], [data-g="wall-subtitle"], [data-g="wall-text"], [data-g="wall-read"]';
const BAR_TARGETS = '[data-g="topbar"], [data-g="bottombar"]';

/** When the wall text starts, once the frame is in the light. */
const TEXT_START = 0.95;

interface ArrivalOptions {
  roomKey: string;
  reducedMotion: boolean;
}

export interface GalleryArrival {
  /** Jumps to the end of the running arrival, before another animation starts. */
  complete: () => void;
  /** Fades the room to black, then calls `onDark` to swap the room. */
  leaveRoom: (onDark: () => void) => void;
}

type Selector = (selector: string) => Element[];

/**
 * Splits into masked lines. Headings get an aria-label of the full text;
 * paragraphs cannot carry aria-label, so their lines stay readable as is.
 */
function splitLines(elements: Element[], aria: 'auto' | 'none'): Element[] {
  return elements.flatMap(
    (element) =>
      new SplitText(element, { type: 'lines', mask: 'lines', aria }).lines,
  );
}

/* Phase 1, independent of fonts: the wall appears, the spot warms up like a
   lamp, then the frame shows in the light. */
function lightScene(
  tl: gsap.core.Timeline,
  q: Selector,
  curtain: boolean,
): void {
  if (curtain) {
    tl.fromTo(
      q('[data-g="curtain"]'),
      { autoAlpha: 1, yPercent: 0 },
      { yPercent: -100, duration: 1.1, ease: 'power4.inOut' },
      0.05,
    );
  }
  tl.to(
    q('[data-g="scene"]'),
    { autoAlpha: 1, duration: 0.9, ease: 'power2.out' },
    0,
  );
  tl.to(
    q('[data-g="spot"]'),
    { autoAlpha: 0.55, duration: 0.22, ease: 'power1.in' },
    0.45,
  )
    .to(q('[data-g="spot"]'), { autoAlpha: 0.38, duration: 0.08, ease: 'none' })
    .to(q('[data-g="spot"]'), {
      autoAlpha: 1,
      duration: 0.7,
      ease: 'power2.out',
    });
  tl.fromTo(
    q('[data-g="hung"], [data-g="placeholder"]'),
    { autoAlpha: 0, scale: 0.985 },
    { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'power3.out' },
    0.75,
  );
}

/* Phase 2, after fonts: the wall text rises line by line behind a mask, then
   the wall label and the bars. Controls work from about 1.2 s. */
function revealText(
  tl: gsap.core.Timeline,
  q: Selector,
  withBars: boolean,
  at: number,
): void {
  const textBlocks = q(
    '[data-g="wall-title"], [data-g="wall-subtitle"], [data-g="wall-text"]',
  );
  tl.set(textBlocks, { autoAlpha: 1 }, at);
  tl.fromTo(
    q('[data-g="wall-label"]'),
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' },
    at,
  );
  tl.fromTo(
    splitLines(q('[data-g="wall-title"]'), 'auto'),
    { yPercent: 125 },
    { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.1 },
    at + 0.05,
  );
  tl.fromTo(
    splitLines(q('[data-g="wall-subtitle"]'), 'none'),
    { yPercent: 125 },
    { yPercent: 0, duration: 0.9, ease: 'expo.out' },
    at + 0.25,
  );
  tl.fromTo(
    splitLines(q('[data-g="wall-text"] p'), 'none'),
    { yPercent: 125 },
    { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.035 },
    at + 0.35,
  );
  tl.fromTo(
    q('[data-g="wall-read"]'),
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: 0.5, ease: 'power2.out' },
    at + 0.35,
  );
  tl.fromTo(
    q('[data-g="cartel"]'),
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' },
    at + 0.25,
  );
  if (withBars) {
    tl.fromTo(
      q('[data-g="topbar"]'),
      { autoAlpha: 0, y: -10 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      at + 0.1,
    );
    tl.fromTo(
      q('[data-g="bottombar"]'),
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      at + 0.15,
    );
  }
}

/**
 * Lights the room: from black, the wall, the spot, the frame, the wall text
 * line by line, then the wall label and the bars. About 2 s, with controls
 * usable from 1.2 s. The scene lights up at once; only the text waits for
 * its fonts. It reruns for each room, and reduced motion uses one fade.
 * The returned object is stable across renders.
 */
export function useGalleryArrival(
  rootRef: RefObject<HTMLElement | null>,
  { roomKey, reducedMotion }: ArrivalOptions,
): GalleryArrival {
  const firstRef = useRef(true);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const leavingRef = useRef(false);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useGSAP(
    (context) => {
      const root = rootRef.current;
      if (root === null) {
        return;
      }
      const withBars = firstRef.current;
      const arrival = firstRef.current ? takeArrival() : null;
      firstRef.current = false;
      const q = gsap.utils.selector(root);
      const targets = q(
        withBars ? `${ROOM_TARGETS}, ${BAR_TARGETS}` : ROOM_TARGETS,
      );
      const markDone = (): void => {
        root.dataset['motion'] = 'done';
      };

      // Hide the new room in this frame, before anything paints, so nothing flashes.
      gsap.set(targets, { autoAlpha: 0 });
      if (arrival === 'curtain' && !reducedMotion) {
        gsap.set(q('[data-g="curtain"]'), { autoAlpha: 1, yPercent: 0 });
      }
      root.dataset['motion'] = 'running';

      if (reducedMotion) {
        timelineRef.current = gsap
          .timeline({ onComplete: markDone })
          .to(targets, { autoAlpha: 1, duration: 0.4, ease: 'none' });
        return;
      }

      const tl = gsap.timeline({ onComplete: markDone });
      lightScene(tl, q, arrival === 'curtain');
      timelineRef.current = tl;

      let cancelled = false;
      void waitForFonts(GALLERY_FONTS).then(() => {
        if (cancelled || leavingRef.current) {
          return;
        }
        context.add(() => {
          revealText(tl, q, withBars, Math.max(TEXT_START, tl.time()));
          // If the scene already finished, continue from its end with the text.
          tl.play();
        });
      });
      return () => {
        cancelled = true;
        timelineRef.current = null;
      };
    },
    {
      scope: rootRef,
      dependencies: [roomKey, reducedMotion],
      revertOnUpdate: true,
    },
  );

  const { contextSafe } = useGSAP({ scope: rootRef });
  const leaveRoomRef = useRef<(onDark: () => void) => void>(() => undefined);
  leaveRoomRef.current = contextSafe((onDark: () => void) => {
    const root = rootRef.current;
    if (root === null || leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    timelineRef.current?.progress(1);
    gsap.to(gsap.utils.selector(root)(ROOM_TARGETS), {
      autoAlpha: 0,
      duration: reducedRef.current ? 0.25 : 0.45,
      ease: 'power2.in',
      onComplete: () => {
        leavingRef.current = false;
        onDark();
      },
    });
  });

  return useMemo<GalleryArrival>(
    () => ({
      complete: () => {
        timelineRef.current?.progress(1);
      },
      leaveRoom: (onDark) => {
        leaveRoomRef.current(onDark);
      },
    }),
    [],
  );
}
