import { Html, useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import styles from './GalleryOverlay.module.css';
import { PaintingFrame } from './PaintingFrame';
import { SculpturePedestal } from './SculpturePedestal';
import type { ArtworkRecord } from './gallery-content';
import { formatIndex } from './gallery-content';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, useGallery } from './gallery-store';

interface ArtworkProps {
  readonly work: ArtworkRecord;
  readonly placed: PlacedArtwork;
  readonly total: number;
}

/** A click that travelled more than this many pixels was a drag. */
const CLICK_TOLERANCE = 6;

/**
 * One work in the room: the 3D object, its pointer behaviour and the wall
 * label that floats beside it while the visitor stands in front of it.
 */
export function Artwork({ work, placed, total }: ArtworkProps) {
  const { phase, hoveredIndex, activeIndex, media } = useGallery();
  const hovered = hoveredIndex === placed.index;
  const active = activeIndex === placed.index && phase === 'visiting';
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

  const labelOffsetX =
    placed.kind === 'sculpture'
      ? placed.width / 2 + 0.55
      : placed.width / 2 + 0.62;
  const labelOffsetY =
    placed.kind === 'sculpture' ? -0.1 : -placed.height / 2 + 0.25;
  const mediaStatus = media[work.id];

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
      {active && (
        <Html
          position={[
            -labelOffsetX,
            placed.kind === 'sculpture'
              ? placed.y + labelOffsetY
              : labelOffsetY,
            0.08,
          ]}
          zIndexRange={[20, 10]}
          className={styles.cartel}
        >
          <button
            type="button"
            className={styles.cartelButton}
            onClick={() => {
              galleryStore.focus(placed.index);
            }}
          >
            <span className={styles.cartelIndex}>
              {formatIndex(placed.index, total)}
            </span>
            <span className={styles.cartelTitle}>{work.title}</span>
            <span className={styles.cartelMeta}>
              {work.medium}
              <br />
              {work.demo
                ? 'Objet de démonstration · contenu fictif'
                : 'Œuvre patrimoniale'}
              {mediaStatus === 'missing' ? (
                <>
                  <br />
                  Image indisponible
                </>
              ) : null}
            </span>
            <span className={styles.cartelAction}>Lire la notice</span>
          </button>
        </Html>
      )}
    </group>
  );
}
