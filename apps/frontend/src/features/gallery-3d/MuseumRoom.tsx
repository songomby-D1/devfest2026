import { ROOM } from './gallery-layout';
import { useOptionalTexture } from './use-optional-texture';

interface MuseumRoomProps {
  /** Length of the room along x, in metres. The room starts at x = 0. */
  readonly length: number;
}

const WINE = '#5a1f17';
const WINE_DEEP = '#3f1510';
const WOOD_DARK = '#1e120c';

/**
 * The architecture: a long room built from six planes, a parquet floor and
 * dark mouldings. Walls use a sheen so the spots read as light on velvet.
 */
export function MuseumRoom({ length }: MuseumRoomProps) {
  const centreX = length / 2;
  const parquet = useOptionalTexture('/media/textures/parquet.jpg', {
    repeat: [length / 2.4, ROOM.depth / 2.4],
  });

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centreX, 0, ROOM.depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[length, ROOM.depth]} />
        <meshStandardMaterial
          color={parquet ? '#d8c8b4' : '#3a2417'}
          map={parquet}
          roughness={0.5}
          metalness={0.04}
        />
      </mesh>

      <mesh
        position={[centreX, ROOM.height / 2, ROOM.wallZ - 0.01]}
        receiveShadow
      >
        <planeGeometry args={[length, ROOM.height]} />
        <meshPhysicalMaterial
          color={WINE}
          roughness={0.92}
          sheen={0.6}
          sheenRoughness={0.7}
          sheenColor="#8f3b2d"
        />
      </mesh>

      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[centreX, ROOM.height, ROOM.depth / 2]}
      >
        <planeGeometry args={[length, ROOM.depth]} />
        <meshStandardMaterial color="#110706" roughness={1} />
      </mesh>

      <mesh
        rotation={[0, Math.PI, 0]}
        position={[centreX, ROOM.height / 2, ROOM.depth]}
      >
        <planeGeometry args={[length, ROOM.height]} />
        <meshStandardMaterial color={WINE_DEEP} roughness={0.95} />
      </mesh>

      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[0, ROOM.height / 2, ROOM.depth / 2]}
      >
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshStandardMaterial color={WINE_DEEP} roughness={0.95} />
      </mesh>

      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[length, ROOM.height / 2, ROOM.depth / 2]}
      >
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshStandardMaterial color={WINE_DEEP} roughness={0.95} />
      </mesh>

      <mesh position={[centreX, 0.07, ROOM.wallZ + 0.03]}>
        <boxGeometry args={[length, 0.14, 0.06]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.55} />
      </mesh>

      <mesh position={[centreX, ROOM.height - 0.09, ROOM.wallZ + 0.06]}>
        <boxGeometry args={[length, 0.18, 0.12]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
      </mesh>
    </group>
  );
}
