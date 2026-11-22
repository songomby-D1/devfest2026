import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PCFShadowMap, PMREMGenerator, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Artwork } from './Artwork';
import { GalleryCamera } from './GalleryCamera';
import { GalleryControls } from './GalleryControls';
import { GalleryLighting } from './GalleryLighting';
import { LabelProjector } from './LabelProjector';
import { MuseumRoom } from './MuseumRoom';
import type { DeviceProfile } from './device';
import { artworks } from './gallery-content';
import { CAMERA_FOV, ROOM, roomLength } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';

const BACKDROP = '#070403';

interface GallerySceneProps {
  readonly device: DeviceProfile;
  readonly placed: readonly PlacedArtwork[];
  /** Called when WebGL fails after mount, so the experience can fall back. */
  readonly onFailure: () => void;
}

interface ProceduralEnvironmentProps {
  readonly intensity: number;
}

/**
 * A procedural studio environment, generated on the GPU at start, gives the
 * gilded frames something to reflect without downloading an HDR file.
 */
function ProceduralEnvironment({ intensity }: ProceduralEnvironmentProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!(gl instanceof WebGLRenderer)) {
      return undefined;
    }
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}

interface BoundaryProps {
  readonly onError: () => void;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly failed: boolean;
}

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** The WebGL layer. Text and controls live in the DOM above it. */
export function GalleryScene({ device, placed, onFailure }: GallerySceneProps) {
  const maxDpr = device.lowPower ? 1 : 1.5;
  const [dpr, setDpr] = useState(maxDpr);
  const length = roomLength(placed);
  const first = placed[0];

  return (
    <SceneErrorBoundary onError={onFailure}>
      <Canvas
        dpr={dpr}
        shadows={
          device.lowPower ? false : { enabled: true, type: PCFShadowMap }
        }
        gl={{
          antialias: !device.lowPower,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        camera={{
          fov: CAMERA_FOV,
          near: 0.05,
          far: 60,
          position: [first?.x ?? 0, 2, ROOM.depth - 0.2],
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(BACKDROP);
        }}
      >
        <color attach="background" args={[BACKDROP]} />
        <fog attach="fog" args={[BACKDROP, 10, 30]} />
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
          }}
          onIncline={() => {
            setDpr(maxDpr);
          }}
        />
        <ProceduralEnvironment intensity={device.lowPower ? 0.18 : 0.24} />
        <MuseumRoom length={length} />
        <GalleryLighting
          placed={placed}
          lowPower={device.lowPower}
          reducedMotion={device.reducedMotion}
        />
        {placed.map((item) => {
          const work = artworks[item.index];
          return work ? (
            <Artwork key={item.id} work={work} placed={item} />
          ) : null;
        })}
        <GalleryCamera placed={placed} reducedMotion={device.reducedMotion} />
        <GalleryControls placed={placed} />
        <LabelProjector placed={placed} />
      </Canvas>
    </SceneErrorBoundary>
  );
}
