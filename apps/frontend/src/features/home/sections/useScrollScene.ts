import type { RefObject } from 'react';
import { useEffect } from 'react';

export interface ScrollSceneFrame {
  /** 0 when the scene's top reaches the top of the viewport, 1 when its end does. */
  progress: number;
  /** Height of the visible area of the scroller. */
  viewport: number;
}

export interface ScrollSceneOptions {
  /** Called once per animation frame while the scroller moves, and on resize. */
  onFrame: (frame: ScrollSceneFrame) => void;
  /** Called on mount and on resize, before onFrame, to size the scene. */
  onResize?: () => void;
  /** When false the scene is static (reduced motion, small screens). */
  enabled: boolean;
}

/**
 * Drives a pinned scene from the scroll position of its scroller, the landing
 * way: one passive scroll listener, at most one update per frame, styles set
 * directly on elements so React never re-renders while scrolling.
 */
export function useScrollScene(
  scrollerRef: RefObject<HTMLElement | null>,
  sceneRef: RefObject<HTMLElement | null>,
  { onFrame, onResize, enabled }: ScrollSceneOptions,
): void {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const scene = sceneRef.current;
    if (scroller === null || scene === null || !enabled) {
      return;
    }
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const viewport = scroller.clientHeight;
      const top =
        scene.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
      const travel = Math.max(1, scene.offsetHeight - viewport);
      const progress = Math.min(1, Math.max(0, -top / travel));
      onFrame({ progress, viewport });
    };
    const request = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    const resize = (): void => {
      onResize?.();
      request();
    };
    resize();
    scroller.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      scroller.removeEventListener('scroll', request);
      window.removeEventListener('resize', resize);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [scrollerRef, sceneRef, onFrame, onResize, enabled]);
}

/** True when the viewport is wide enough for pinned, scroll-driven scenes. */
export function wideViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth > 760;
}
