import { useGLTF, useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  type Points,
  type SpotLight,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAMERA_DISTANCE,
  chapterZ,
  damp,
  sinkAmount,
  SPACING,
  stageOffset,
} from './depth';
import type { Chapter } from './exhibition-content';
import type { DepthState } from './use-depth-navigation';

const NIGHT = '#0b0806';
const GOLD = '#c8a174';
const DRACO_PATH = `${import.meta.env.BASE_URL}draco/`;

export interface DepthSceneProps {
  readonly chapters: readonly Chapter[];
  readonly depth: DepthState;
  readonly reducedMotion: boolean;
  readonly lowPower: boolean;
  /** Called when WebGL fails after mount, so the page can fall back. */
  readonly onFailure: () => void;
}

/** Loading progress of the GLB files, for the HTML veil above the canvas. */
export function useSceneProgress(): { active: boolean; progress: number } {
  const { active, progress } = useProgress();
  return { active, progress };
}

function Environment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    if (!(gl instanceof WebGLRenderer)) return undefined;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    scene.environment = texture;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      texture.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Eases the camera along -z toward the target chapter, with a slow breath. */
function DepthCamera({
  depth,
  reducedMotion,
}: {
  readonly depth: DepthState;
  readonly reducedMotion: boolean;
}) {
  const look = useMemo(() => new Vector3(), []);
  useFrame((state, delta) => {
    depth.current = damp(
      depth.current,
      depth.target,
      reducedMotion ? 14 : 2.6,
      Math.min(delta, 0.1),
    );
    const { camera, size, clock } = state;
    const aspect = size.width / size.height;
    const narrow = aspect <= 1.15;
    const offset = stageOffset(aspect);
    const breath = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.04;
    const z = chapterZ(depth.current) + CAMERA_DISTANCE + (narrow ? 1.6 : 0);
    camera.position.set(offset * 0.35, (narrow ? 1.75 : 1.4) + breath, z);
    // On a narrow screen the camera looks lower, so the model sits above the text card.
    look.set(offset, narrow ? 0.35 : 0.95, chapterZ(depth.current));
    camera.lookAt(look);
  });
  return null;
}

/** A floor that fades into the fog, with a gold threshold line at each chapter. */
function Corridor({ count }: { readonly count: number }) {
  const length = count * SPACING + 40;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -length / 2 + 20]}>
        <planeGeometry args={[40, length]} />
        <meshStandardMaterial color="#120d0a" roughness={0.92} metalness={0} />
      </mesh>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          rotation-x={-Math.PI / 2}
          position={[0, 0.002, chapterZ(index) + 2.6]}
        >
          <planeGeometry args={[7, 0.012]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

/** A thin gold portal in front of each chapter: crossing it marks the passage. */
function Portal({
  index,
  offset,
}: {
  readonly index: number;
  readonly offset: number;
}) {
  const width = 3.6;
  const height = 3.7;
  const bar = 0.035;
  // Just behind the camera when it faces this chapter, so the portal frames
  // the chapter from afar and is crossed on the way in, never cut in close-up.
  const z = chapterZ(index) + CAMERA_DISTANCE + 2;
  return (
    <group position={[offset, 0, z]}>
      {[
        { position: [-width / 2, height / 2, 0], size: [bar, height, bar] },
        { position: [width / 2, height / 2, 0], size: [bar, height, bar] },
        { position: [0, height, 0], size: [width + bar, bar, bar] },
      ].map((part, key) => (
        <mesh key={key} position={part.position as [number, number, number]}>
          <boxGeometry args={part.size as [number, number, number]} />
          <meshStandardMaterial
            color={GOLD}
            emissive={GOLD}
            emissiveIntensity={0.35}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Drifting dust gives parallax, so moving forward reads as depth. */
function Dust({
  count,
  length,
}: {
  readonly count: number;
  readonly length: number;
}) {
  const points = useRef<Points>(null);
  const sprite = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context !== null) {
      const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(
    () => () => {
      sprite.dispose();
    },
    [sprite],
  );
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = Math.random() * 4.5;
      positions[i * 3 + 2] = 8 - Math.random() * length;
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    return buffer;
  }, [count, length]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useFrame((_state, delta) => {
    if (points.current !== null) points.current.rotation.y += delta * 0.004;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color="#e8c79a"
        map={sprite}
        alphaTest={0.01}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/** Shown when a model cannot load: a wire silhouette instead of a hole. */
function MissingModel({ height }: { readonly height: number }) {
  return (
    <mesh position={[0, 0.16 + height / 2, 0]}>
      <boxGeometry args={[height * 0.45, height, height * 0.45]} />
      <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.35} />
    </mesh>
  );
}

class ModelBoundary extends Component<
  { readonly fallback: ReactNode; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Station({
  chapter,
  index,
  depth,
  offset,
  reducedMotion,
}: {
  readonly chapter: Chapter;
  readonly index: number;
  readonly depth: DepthState;
  readonly offset: number;
  readonly reducedMotion: boolean;
}) {
  const root = useRef<Group>(null);
  const spot = useRef<SpotLight>(null);
  const ring = useRef<Mesh>(null);
  const target = useMemo(() => new Object3D(), []);
  const z = chapterZ(index);
  const activeRef = useRef(false);

  useEffect(() => {
    if (spot.current !== null) spot.current.target = target;
  }, [target]);

  useFrame((_state, delta) => {
    const distance = Math.abs(depth.current - index);
    activeRef.current = distance < 0.5;
    // A chapter the visitor walks past sinks into the floor before the camera reaches it.
    const passed = sinkAmount(depth.current - index);
    if (root.current !== null) {
      root.current.position.y = -passed * (chapter.height + 0.6);
      root.current.visible = passed < 0.999;
    }
    const glow = Math.max(0, 1 - distance * 0.85);
    if (spot.current !== null) {
      spot.current.intensity = damp(
        spot.current.intensity,
        18 + glow * 62,
        6,
        delta,
      );
    }
    if (ring.current !== null) {
      const material = ring.current.material as MeshStandardMaterial;
      material.emissiveIntensity = 0.15 + glow * 1.1;
    }
  });

  return (
    <group ref={root} position={[offset, 0, z]}>
      <primitive object={target} position={[0, chapter.height * 0.5, 0]} />
      <spotLight
        ref={spot}
        position={[0.6, 5.2, 2.2]}
        angle={0.42}
        penumbra={0.85}
        intensity={20}
        distance={12}
        decay={1.6}
        color="#ffe2c0"
      />
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.78, 0.86, 0.16, 64]} />
        <meshStandardMaterial
          color="#1b1410"
          roughness={0.75}
          metalness={0.1}
        />
      </mesh>
      <mesh ref={ring} position={[0, 0.162, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.76, 0.79, 96]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={new Color(GOLD)}
          emissiveIntensity={0.2}
        />
      </mesh>
      <ModelBoundary fallback={<MissingModel height={chapter.height} />}>
        <Suspense fallback={<MissingModel height={chapter.height} />}>
          <ActiveModel
            chapter={chapter}
            activeRef={activeRef}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}

/**
 * Scales a GLB to the chapter height and stands it on the plinth. The active
 * flag is read every frame through a ref, without re-rendering React.
 */
function ActiveModel({
  chapter,
  activeRef,
  reducedMotion,
}: {
  readonly chapter: Chapter;
  readonly activeRef: { readonly current: boolean };
  readonly reducedMotion: boolean;
}) {
  const { scene } = useGLTF(chapter.model, DRACO_PATH);
  const turntable = useRef<Group>(null);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const scale = chapter.height / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    const center = box.getCenter(new Vector3());
    clone.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    );
    return clone;
  }, [scene, chapter.height]);
  useFrame((_state, delta) => {
    if (turntable.current === null || reducedMotion) return;
    turntable.current.rotation.y += delta * (activeRef.current ? 0.32 : 0.06);
  });
  return (
    <group ref={turntable} position={[0, 0.16, 0]}>
      <primitive object={object} />
    </group>
  );
}

function Stations({
  chapters,
  depth,
  reducedMotion,
}: {
  readonly chapters: readonly Chapter[];
  readonly depth: DepthState;
  readonly reducedMotion: boolean;
}) {
  const aspect = useThree((state) => state.size.width / state.size.height);
  const offset = stageOffset(aspect);
  return (
    <>
      {chapters.map((chapter, index) => (
        <group key={chapter.id}>
          <Portal index={index} offset={offset} />
          <Station
            chapter={chapter}
            index={index}
            depth={depth}
            offset={offset}
            reducedMotion={reducedMotion}
          />
        </group>
      ))}
    </>
  );
}

class SceneBoundary extends Component<
  { readonly onError: () => void; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The storyline in depth: chapters stand one behind the other along a dark
 * corridor, and the camera travels forward through a gold portal to reach
 * each one. All text and controls are HTML above the canvas.
 */
export function DepthScene({
  chapters,
  depth,
  reducedMotion,
  lowPower,
  onFailure,
}: DepthSceneProps) {
  return (
    <SceneBoundary onError={onFailure}>
      <Canvas
        dpr={lowPower ? [1, 1.5] : [1, 2]}
        camera={{
          fov: 40,
          near: 0.1,
          far: 90,
          position: [0, 1.4, CAMERA_DISTANCE],
        }}
        gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', onFailure);
        }}
        aria-hidden="true"
      >
        <color attach="background" args={[NIGHT]} />
        <fogExp2 attach="fog" args={[NIGHT, 0.068]} />
        <ambientLight intensity={0.18} />
        <hemisphereLight args={['#f3dcc0', '#120a06', 0.4]} />
        <Environment />
        <DepthCamera depth={depth} reducedMotion={reducedMotion} />
        <Corridor count={chapters.length} />
        <Dust
          count={lowPower ? 260 : 700}
          length={chapters.length * SPACING + 16}
        />
        <Stations
          chapters={chapters}
          depth={depth}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </SceneBoundary>
  );
}
