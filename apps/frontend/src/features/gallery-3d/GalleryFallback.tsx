import { useEffect } from 'react';
import styles from './GalleryExperience.module.css';
import { artworks, formatIndex } from './gallery-content';
import type { PlacedArtwork } from './gallery-layout';
import { handleGalleryKey } from './gallery-navigation';
import { galleryStore, useGallery } from './gallery-store';

interface GalleryFallbackProps {
  readonly placed: readonly PlacedArtwork[];
}

/**
 * Without WebGL the room becomes a lit wall drawn in CSS. The visitor keeps
 * the same controls, labels and notice; only the camera travelling goes.
 */
export function GalleryFallback({ placed }: GalleryFallbackProps) {
  const state = useGallery();
  const index = state.focusedIndex ?? state.activeIndex;
  const work = artworks[index] ?? artworks[0];

  useEffect(() => {
    if (state.phase === 'entering') {
      galleryStore.introDone();
    }
  }, [state.phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      handleGalleryKey(event, placed);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [placed]);

  if (!work) {
    return null;
  }
  const focused = state.phase === 'focus';

  return (
    <div
      className={styles.fallbackRoom}
      data-focused={focused ? 'true' : 'false'}
    >
      <div className={styles.fallbackFloor} />
      <figure className={styles.fallbackWork}>
        {work.image !== null && state.media[work.id] !== 'missing' ? (
          <img
            className={
              work.kind === 'painting'
                ? styles.fallbackCanvas
                : styles.fallbackObject
            }
            src={work.image}
            alt={`${work.title}, ${work.artist}`}
            onLoad={() => {
              galleryStore.setMediaStatus(work.id, 'ready');
            }}
            onError={() => {
              galleryStore.setMediaStatus(work.id, 'missing');
            }}
          />
        ) : (
          <div
            className={styles.fallbackPlaceholder}
            role="img"
            aria-label={work.title}
          >
            <span>
              {work.kind === 'sculpture'
                ? 'Objet de démonstration'
                : 'Image indisponible'}
            </span>
          </div>
        )}
        <figcaption className={styles.fallbackCaption}>
          <span>{formatIndex(index)}</span>
          <span>{work.title}</span>
          {!focused ? (
            <button
              type="button"
              className={styles.fallbackButton}
              onClick={() => {
                galleryStore.focus(index);
              }}
            >
              Lire la notice
            </button>
          ) : null}
        </figcaption>
      </figure>
      <p className={styles.fallbackNote}>
        Rendu sans WebGL · l’expérience 3D n’est pas disponible sur cet
        appareil.
      </p>
    </div>
  );
}
