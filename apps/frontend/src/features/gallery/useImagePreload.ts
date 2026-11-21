import { useEffect } from 'react';
import type { ImageSource } from '../../lib/media/media';

/** Delay before warming neighbours, so they never compete with the room's first paint. */
const PRELOAD_DELAY_MS = 2500;

/** Warms the browser cache for the neighbouring artworks once the room has lit up. */
export function useImagePreload(images: readonly ImageSource[]): void {
  useEffect(() => {
    let loaders: HTMLImageElement[] = [];
    const timer = window.setTimeout(() => {
      loaders = images.map((image) => {
        const loader = new Image();
        loader.srcset = image.srcSet;
        loader.sizes = '(max-width: 767px) 40vw, 18vw';
        loader.src = image.src;
        return loader;
      });
    }, PRELOAD_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      for (const loader of loaders) {
        loader.src = '';
      }
    };
  }, [images]);
}
