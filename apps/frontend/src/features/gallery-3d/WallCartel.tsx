import styles from './GalleryOverlay.module.css';
import { artworks, formatIndex } from './gallery-content';
import type { PlacedArtwork } from './gallery-layout';
import { galleryStore, useGallery } from './gallery-store';
import { labelAnchor } from './label-anchor';

interface WallCartelProps {
  readonly placed: readonly PlacedArtwork[];
}

/**
 * The wall label (cartel) beside the work in front of the visitor. It is a
 * plain DOM element that the LabelProjector moves every frame, so it stays
 * crisp, focusable and free of portals.
 */
export function WallCartel({ placed }: WallCartelProps) {
  const { phase, activeIndex, media } = useGallery();
  const current = placed[activeIndex] ?? placed[0];
  const work = current ? artworks[current.index] : undefined;
  if (!current || !work) {
    return null;
  }
  const visible = phase === 'visiting';
  const mediaStatus = media[work.id];

  return (
    <div
      ref={(element) => {
        labelAnchor.element = element;
      }}
      className={styles.cartel}
      style={{ opacity: 0 }}
    >
      <button
        type="button"
        className={styles.cartelButton}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        onClick={() => {
          galleryStore.focus(current.index);
        }}
      >
        <span className={styles.cartelIndex}>
          {formatIndex(current.index, placed.length)}
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
    </div>
  );
}
