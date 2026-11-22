import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Object3D } from 'three';
import type { AmbientLight, HemisphereLight, SpotLight } from 'three';
import { ROOM, damp, easeOutCubic, spotActivity } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, rail } from './gallery-store';
import type { GalleryState } from './gallery-store';

interface GalleryLightingProps {
  readonly placed: readonly PlacedArtwork[];
  readonly lowPower: boolean;
  readonly reducedMotion: boolean;
}

const SPOT_IDLE = 9;
const SPOT_PEAK = 78;
const SPOT_COLOUR = '#ffd9b0';
/** Seconds between the start of the intro and the first spot switching on. */
const INTRO_DELAY = 0.7;
const INTRO_STAGGER = 0.22;
const INTRO_RAMP = 1.1;

/**
 * 0 before the intro, then each spot comes on in turn from the entrance,
 * and 1 once the visit has started. Reduced motion skips the sequence.
 */
export function spotMaster(
  state: GalleryState,
  index: number,
  now: number,
  reducedMotion: boolean,
): number {
  switch (state.phase) {
    case 'entrance':
      return 0;
    case 'entering': {
      if (reducedMotion) {
        return 1;
      }
      const elapsed = (now - (state.introStartedAt ?? now)) / 1000;
      return easeOutCubic(
        (elapsed - INTRO_DELAY - INTRO_STAGGER * index) / INTRO_RAMP,
      );
    }
    case 'visiting':
    case 'focus':
      return 1;
  }
}

interface ArtworkSpotProps {
  readonly work: PlacedArtwork;
  readonly castShadow: boolean;
  readonly reducedMotion: boolean;
}

function ArtworkSpot({ work, castShadow, reducedMotion }: ArtworkSpotProps) {
  const light = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const current = light.current;
    if (!current) {
      return;
    }
    current.shadow.mapSize.set(1024, 1024);
    current.shadow.bias = -0.0005;
    current.shadow.normalBias = 0.02;
    current.shadow.camera.near = 0.5;
    current.shadow.camera.far = 9;
  }, []);

  useFrame((_, delta) => {
    const current = light.current;
    if (!current) {
      return;
    }
    const state = galleryStore.getState();
    const master = spotMaster(
      state,
      work.index,
      performance.now(),
      reducedMotion,
    );
    const activity = spotActivity(rail.current - work.x);
    let focusWeight = 1;
    if (state.phase === 'focus') {
      focusWeight = state.focusedIndex === work.index ? 1.12 : 0.22;
    }
    const wanted =
      (SPOT_IDLE + (SPOT_PEAK - SPOT_IDLE) * activity) * master * focusWeight;
    current.intensity = damp(
      current.intensity,
      wanted,
      3.4,
      Math.min(delta, 0.05),
    );
  });

  const aboveWork = work.kind === 'sculpture' ? work.z + 1.6 : work.z + 2.05;

  return (
    <>
      <primitive object={target} position={[work.x, work.y - 0.05, work.z]} />
      <spotLight
        ref={light}
        position={[work.x + 0.15, ROOM.height - 0.25, aboveWork]}
        target={target}
        angle={work.kind === 'sculpture' ? 0.42 : 0.5}
        penumbra={0.8}
        decay={1.6}
        distance={14}
        intensity={0}
        color={SPOT_COLOUR}
        castShadow={castShadow}
      />
    </>
  );
}

/**
 * Low ambience plus one spot per work. Spot intensity follows the visitor:
 * the work in front of them is fully lit, its neighbours are dimmed, and
 * every change is damped so nothing flickers. Only sculpture spots cast
 * shadows, which keeps the shadow pass to a handful of lights.
 */
export function GalleryLighting({
  placed,
  lowPower,
  reducedMotion,
}: GalleryLightingProps) {
  const ambient = useRef<AmbientLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);

  useFrame((_, delta) => {
    const state = galleryStore.getState();
    const master = spotMaster(state, 0, performance.now(), reducedMotion);
    const dt = Math.min(delta, 0.05);
    if (ambient.current) {
      ambient.current.intensity = damp(
        ambient.current.intensity,
        0.05 + 0.22 * master,
        2.5,
        dt,
      );
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = damp(
        hemisphere.current.intensity,
        0.28 * master,
        2.5,
        dt,
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.05} color="#ffe6cf" />
      <hemisphereLight
        ref={hemisphere}
        intensity={0}
        color="#5a3028"
        groundColor="#140806"
      />
      {placed.map((work) => (
        <ArtworkSpot
          key={work.id}
          work={work}
          castShadow={!lowPower && work.kind === 'sculpture'}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
