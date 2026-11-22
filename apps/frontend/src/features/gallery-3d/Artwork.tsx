import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { PaintingFrame } from './PaintingFrame';
import { SculpturePedestal } from './SculpturePedestal';
import type { ArtworkRecord } from './gallery-content';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, useGallery } from './gallery-store';

interface ArtworkProps {
  readonly work: ArtworkRecord;
  readonly placed: PlacedArtwork;
}

/** A click that travelled more than this many pixels was a drag. */
const CLICK_TOLERANCE = 6;

/**
 * One work in the room: the 3D object and its pointer behaviour. Hover
 * highlights it, a clean click (not a drag) brings it into focus.
 */
export function Artwork({ work, placed }: ArtworkProps) {
  const { phase, hoveredIndex } = useGallery();
  const hovered = hoveredIndex === placed.index;
  useCursor(hovered && phase === 'visiting');

  const handleOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    if (galleryStore.getState().phase === 'visiting') {
      galleryStore.setHovered(placed.index);
    }
  };

  const handleOut = (): void => {
    if (galleryStore.getState().hoveredIndex === placed.index) {
      galleryStore.setHovered(null);
    }
  };

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (event.delta > CLICK_TOLERANCE) {
      return;
    }
    if (galleryStore.getState().phase === 'visiting') {
      galleryStore.focus(placed.index);
    }
  };

  return (
    <group
      position={[
        placed.x,
        placed.kind === 'sculpture' ? 0 : placed.y,
        placed.z,
      ]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {placed.kind === 'sculpture' ? (
        <SculpturePedestal work={work} index={placed.index} hovered={hovered} />
      ) : (
        <PaintingFrame work={work} hovered={hovered} />
      )}
    </group>
  );
}
