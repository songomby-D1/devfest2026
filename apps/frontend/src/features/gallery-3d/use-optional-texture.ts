import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';
import { galleryStore } from './gallery-store';

export interface OptionalTextureOptions {
  /** Work id whose media status the store should track. */
  readonly mediaId?: string;
  readonly repeat?: readonly [number, number];
}

/**
 * Loads a texture without Suspense, so a missing file never blocks the room:
 * the caller receives null and renders its missing-media look instead.
 * The texture is disposed when the component unmounts or the source changes.
 */
export function useOptionalTexture(
  src: string | null,
  options: OptionalTextureOptions = {},
): Texture | null {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const { mediaId, repeat } = options;
  const repeatX = repeat?.[0];
  const repeatY = repeat?.[1];

  useEffect(() => {
    if (src === null) {
      return undefined;
    }
    let active = true;
    let loaded: Texture | null = null;
    if (mediaId !== undefined) {
      galleryStore.setMediaStatus(mediaId, 'loading');
    }
    new TextureLoader().load(
      src,
      (result) => {
        if (!active) {
          result.dispose();
          return;
        }
        result.colorSpace = SRGBColorSpace;
        result.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        if (repeatX !== undefined && repeatY !== undefined) {
          result.wrapS = RepeatWrapping;
          result.wrapT = RepeatWrapping;
          result.repeat.set(repeatX, repeatY);
        }
        loaded = result;
        setTexture(result);
        if (mediaId !== undefined) {
          galleryStore.setMediaStatus(mediaId, 'ready');
        }
      },
      undefined,
      () => {
        if (active && mediaId !== undefined) {
          galleryStore.setMediaStatus(mediaId, 'missing');
        }
      },
    );
    return () => {
      active = false;
      loaded?.dispose();
      setTexture(null);
    };
  }, [src, mediaId, repeatX, repeatY, gl]);

  return texture;
}
