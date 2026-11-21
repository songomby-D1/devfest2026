import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import {
  CAMERA_FOV,
  clamp,
  damp,
  focusPose,
  introPose,
  nearestIndex,
  visitPose,
} from './gallery-layout';
import type { CameraPose, PlacedArtwork } from './gallery-layout';
import { currentZoom, galleryStore, rail, railTo } from './gallery-store';

interface GalleryCameraProps {
  readonly placed: readonly PlacedArtwork[];
  readonly reducedMotion: boolean;
}

export const INTRO_SECONDS = 3.4;

/**
 * The guided camera. There is no free camera: every phase resolves to one
 * pose, and the camera is damped towards it each frame. The visitor only
 * drives the rail position, which the visit pose follows.
 */
export function GalleryCamera({ placed, reducedMotion }: GalleryCameraProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const position = useRef(new Vector3());
  const target = useRef(new Vector3());
  const started = useRef(false);

  useEffect(
    () =>
      galleryStore.subscribe(() => {
        const state = galleryStore.getState();
        if (state.phase === 'focus' && state.focusedIndex !== null) {
          const work = placed[state.focusedIndex];
          if (work) {
            railTo(work.x);
          }
        }
      }),
    [placed],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const state = galleryStore.getState();

    rail.current = damp(
      rail.current,
      rail.target,
      reducedMotion ? 30 : 4.5,
      dt,
    );
    if (Math.abs(rail.current - rail.target) < 0.0005) {
      rail.current = rail.target;
    }
    if (state.phase === 'visiting') {
      const nearest = nearestIndex(placed, rail.target);
      if (nearest !== state.activeIndex) {
        galleryStore.setActive(nearest);
      }
    }

    let pose: CameraPose;
    let lambda: number;
    switch (state.phase) {
      case 'entrance':
        pose = introPose(0, rail.current);
        lambda = 30;
        break;
      case 'entering': {
        const now = performance.now();
        const elapsed = (now - (state.introStartedAt ?? now)) / 1000;
        const progress = reducedMotion
          ? 1
          : clamp(elapsed / INTRO_SECONDS, 0, 1);
        pose = introPose(progress, rail.current);
        lambda = 14;
        if (progress >= 1) {
          galleryStore.introDone();
        }
        break;
      }
      case 'visiting':
        pose = visitPose(rail.current);
        lambda = 5;
        break;
      case 'focus': {
        const work =
          state.focusedIndex === null ? undefined : placed[state.focusedIndex];
        pose = work
          ? focusPose(
              work,
              CAMERA_FOV,
              size.width / Math.max(size.height, 1),
              currentZoom(state.zoomLevel),
            )
          : visitPose(rail.current);
        lambda = 3.4;
        break;
      }
    }

    const k = reducedMotion ? 30 : lambda;
    const p = position.current;
    const t = target.current;
    if (!started.current) {
      p.set(pose.position[0], pose.position[1], pose.position[2]);
      t.set(pose.target[0], pose.target[1], pose.target[2]);
      started.current = true;
    } else {
      p.set(
        damp(p.x, pose.position[0], k, dt),
        damp(p.y, pose.position[1], k, dt),
        damp(p.z, pose.position[2], k, dt),
      );
      t.set(
        damp(t.x, pose.target[0], k, dt),
        damp(t.y, pose.target[1], k, dt),
        damp(t.z, pose.target[2], k, dt),
      );
    }
    camera.position.copy(p);
    camera.lookAt(t);
  });

  return null;
}
