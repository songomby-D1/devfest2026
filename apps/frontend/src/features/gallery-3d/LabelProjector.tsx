import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore } from './gallery-store';
import { labelAnchor, labelAnchorFor } from './label-anchor';

interface LabelProjectorProps {
  readonly placed: readonly PlacedArtwork[];
}

/**
 * Projects the active work's label anchor to screen space each frame and
 * positions the DOM wall label there. Lives inside the canvas so it reads
 * the live camera; renders nothing itself.
 */
export function LabelProjector({ placed }: LabelProjectorProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const point = useRef(new Vector3());

  useFrame(() => {
    const element = labelAnchor.element;
    if (!element) {
      return;
    }
    const state = galleryStore.getState();
    const work = placed[state.activeIndex];
    if (!work) {
      element.style.opacity = '0';
      return;
    }
    const [x, y, z] = labelAnchorFor(work);
    const projected = point.current.set(x, y, z).project(camera);
    const inFront = projected.z < 1;
    const left = ((projected.x + 1) / 2) * size.width;
    const top = ((1 - projected.y) / 2) * size.height;
    element.style.transform = `translate3d(${String(Math.round(left))}px, ${String(Math.round(top))}px, 0)`;
    element.style.opacity = state.phase === 'visiting' && inFront ? '1' : '0';
    element.style.pointerEvents =
      state.phase === 'visiting' && inFront ? 'auto' : 'none';
  });

  return null;
}
