import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, Vector2 } from 'three';
import type { Group } from 'three';
import type { ArtworkRecord } from './gallery-content';
import { ROOM, damp } from './gallery-layout';
import { galleryStore, spin } from './gallery-store';

interface SculpturePedestalProps {
  readonly work: ArtworkRecord;
  readonly index: number;
  readonly hovered: boolean;
}

/** Normalised profiles (radius, height) in [0, 1], revolved around the y axis. */
const PROFILES: Readonly<
  Record<string, readonly (readonly [number, number])[]>
> = {
  jar: [
    [0, 0],
    [0.42, 0],
    [0.7, 0.06],
    [0.92, 0.22],
    [1, 0.4],
    [0.94, 0.58],
    [0.72, 0.74],
    [0.52, 0.84],
    [0.5, 0.92],
    [0.6, 0.98],
    [0.64, 1],
    [0.52, 1],
    [0.44, 0.9],
    [0.4, 0.8],
  ],
  pot: [
    [0, 0],
    [0.5, 0],
    [0.82, 0.08],
    [1, 0.38],
    [0.96, 0.66],
    [0.84, 0.86],
    [0.9, 0.96],
    [0.96, 1],
    [0.8, 1],
    [0.76, 0.88],
    [0.7, 0.7],
  ],
};

function profileFor(work: ArtworkRecord): Vector2[] {
  const shape =
    PROFILES[work.id === 'sinibe' ? 'jar' : 'pot'] ?? PROFILES.pot ?? [];
  const radius = work.width / 2;
  return shape.map(([r, y]) => new Vector2(r * radius, y * work.height));
}

/**
 * A plaster pedestal and a procedural clay pot. In inspection mode the pot
 * turns under the pointer and keeps a slow idle rotation, so the visitor
 * can read its volume without any free camera.
 */
export function SculpturePedestal({
  work,
  index,
  hovered,
}: SculpturePedestalProps) {
  const pot = useRef<Group>(null);
  const angle = useRef(0);
  const lift = useRef(0);
  const profile = useMemo(() => profileFor(work), [work]);

  useFrame((_, delta) => {
    const group = pot.current;
    if (!group) {
      return;
    }
    const dt = Math.min(delta, 0.05);
    const state = galleryStore.getState();
    const inspecting =
      state.phase === 'focus' &&
      state.focusedIndex === index &&
      state.inspecting;
    if (inspecting) {
      const idle = spin.dragging ? 0 : 0.35;
      angle.current += (spin.velocity + idle) * dt;
      spin.velocity = damp(spin.velocity, 0, 2.2, dt);
    }
    lift.current = damp(lift.current, hovered ? 0.02 : 0, 8, dt);
    group.rotation.y = angle.current;
    group.position.y = ROOM.pedestalHeight + lift.current;
  });

  const size = ROOM.pedestalSize;

  return (
    <group>
      <mesh position={[0, ROOM.pedestalHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size, ROOM.pedestalHeight, size]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, ROOM.pedestalHeight + 0.004, 0]} receiveShadow>
        <boxGeometry args={[size + 0.02, 0.008, size + 0.02]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.85} />
      </mesh>
      <group ref={pot} position={[0, ROOM.pedestalHeight, 0]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[profile, 56]} />
          <meshStandardMaterial
            color="#a0603f"
            roughness={0.84}
            metalness={0}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
