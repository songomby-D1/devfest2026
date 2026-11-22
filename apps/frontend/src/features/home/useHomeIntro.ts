import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { waitForFonts } from '../../lib/motion/fonts';
import { gsap, SplitText, useGSAP } from '../../lib/motion/gsap';
import type { IntroVariant } from '../../lib/motion/motion-prefs';

/** Fonts the headline and copy need before SplitText measures the lines. */
const HOME_FONTS = [
  '700 80px "TikTok Sans"',
  '400 16px "TikTok Sans"',
  '400 14px "Departure Mono"',
];

/** Headline lines start this far below their mask, which has extra headroom. */
export const LINE_OFFSET = 130;

interface Timing {
  nav: number;
  lines: number;
  frames: number;
  objects: number;
  description: number;
  ctas: number;
  clickable: number;
}

/*
 * hanging: the visitor watches a room being hung. Calm and precise, about 2.2 s.
 * light:   a warm gallery light rises first, then the same hanging.
 * focus:   a camera pulls focus from the foreground objects to the frames.
 */
const TIMINGS: Record<IntroVariant, Timing> = {
  hanging: {
    nav: 0,
    lines: 0.15,
    frames: 0.6,
    objects: 0.9,
    description: 1.2,
    ctas: 1.3,
    clickable: 1.4,
  },
  light: {
    nav: 0.3,
    lines: 0.45,
    frames: 0.8,
    objects: 1.05,
    description: 1.4,
    ctas: 1.5,
    clickable: 1.6,
  },
  focus: {
    nav: 0,
    lines: 0.15,
    frames: 0.45,
    objects: 0.2,
    description: 1.2,
    ctas: 1.3,
    clickable: 1.4,
  },
};

interface IntroOptions {
  variant: IntroVariant;
  reducedMotion: boolean;
  splitRef: RefObject<SplitText | null>;
  onComplete: () => void;
}

function playIntro(
  root: HTMLElement,
  variant: IntroVariant,
  splitRef: RefObject<SplitText | null>,
  finish: () => void,
): void {
  const q = gsap.utils.selector(root);
  const timing = TIMINGS[variant];
  const blur = variant === 'focus';

  const headline = q('[data-anim="headline"]');
  const split = new SplitText(headline, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'headline-line',
    aria: 'auto',
  });
  splitRef.current = split;

  const tl = gsap.timeline({ onComplete: finish });

  if (variant === 'light') {
    tl.fromTo(
      q('[data-anim="dim"]'),
      { autoAlpha: 1 },
      { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut' },
      0.05,
    );
  }

  tl.fromTo(
    q('[data-anim="nav"]'),
    { autoAlpha: 0, y: -12 },
    { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' },
    timing.nav,
  );

  gsap.set(headline, { autoAlpha: 1 });
  tl.fromTo(
    split.lines,
    { yPercent: LINE_OFFSET },
    { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 },
    timing.lines,
  );

  q('[data-anim="exhibit"][data-kind="frame"]').forEach((frame, index) => {
    const at = timing.frames + index * 0.25;
    const inside = gsap.utils.selector(frame);
    tl.fromTo(
      frame,
      blur
        ? { autoAlpha: 0, filter: 'blur(10px)', scale: 1.03 }
        : { autoAlpha: 0 },
      blur
        ? {
            autoAlpha: 1,
            filter: 'blur(0px)',
            scale: 1,
            duration: 1.1,
            ease: 'power3.out',
          }
        : { autoAlpha: 1, duration: 0.01 },
      at,
    );
    tl.fromTo(
      inside('[data-anim="reveal"]'),
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.out' },
      at,
    );
    tl.fromTo(
      inside('[data-anim="image"]'),
      { scale: 1.14 },
      { scale: 1, duration: 1.3, ease: 'power3.out' },
      at,
    );
  });

  q('[data-anim="exhibit"][data-kind="object"]').forEach((object, index) => {
    const at = timing.objects + index * 0.12;
    tl.fromTo(
      object,
      blur
        ? { autoAlpha: 0, y: -16, filter: 'blur(10px)' }
        : { autoAlpha: 0, y: -16 },
      blur
        ? {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 1,
            ease: 'power3.out',
          }
        : { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' },
      at,
    );
    tl.fromTo(
      gsap.utils.selector(object)('[data-anim="shadow"]'),
      { autoAlpha: 0, scaleX: 0.6 },
      { autoAlpha: 1, scaleX: 1, duration: 0.9, ease: 'power3.out' },
      at + 0.1,
    );
  });

  tl.fromTo(
    q('[data-anim="description"]'),
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' },
    timing.description,
  );

  const ctas = q('[data-anim="ctas"]');
  gsap.set(ctas, { pointerEvents: 'none' });
  tl.fromTo(
    q('[data-anim="ctas"] > *'),
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.1 },
    timing.ctas,
  );
  tl.set(ctas, { pointerEvents: 'auto' }, timing.clickable);

  // The "from" states are applied, so the CSS that hides content before JS can go.
  root.dataset['motion'] = 'running';
}

/**
 * Plays the home entrance. Content stays hidden until its animation starts, the
 * headline is split only after its fonts load, and reduced motion gets a
 * single 0.4 s fade.
 */
export function useHomeIntro(
  rootRef: RefObject<HTMLElement | null>,
  { variant, reducedMotion, splitRef, onComplete }: IntroOptions,
): void {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useGSAP(
    (context) => {
      const root = rootRef.current;
      if (root === null) {
        return;
      }
      const finish = (): void => {
        root.dataset['motion'] = 'done';
        onCompleteRef.current();
      };

      if (reducedMotion) {
        gsap.fromTo(
          root,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.4, ease: 'none', onComplete: finish },
        );
        root.dataset['motion'] = 'running';
        return;
      }

      let cancelled = false;
      void waitForFonts(HOME_FONTS).then(() => {
        if (!cancelled) {
          context.add(() => {
            playIntro(root, variant, splitRef, finish);
          });
        }
      });
      return () => {
        cancelled = true;
      };
    },
    {
      scope: rootRef,
      dependencies: [variant, reducedMotion],
      revertOnUpdate: true,
    },
  );
}
