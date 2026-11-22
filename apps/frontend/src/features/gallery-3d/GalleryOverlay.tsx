import {
  ArrowLeftIcon,
  ArrowRightIcon,
  RotateIcon,
  ZoomIcon,
} from './GalleryIcons';
import styles from './GalleryOverlay.module.css';
import { artworks, formatIndex, roomOf, rooms } from './gallery-content';
import { ZOOM_LEVELS } from './gallery-layout';
import type { PlacedArtwork } from './gallery-layout';
import { goToWork, stepWork } from './gallery-navigation';
import { galleryStore, useGallery } from './gallery-store';

interface GalleryOverlayProps {
  readonly placed: readonly PlacedArtwork[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The museum chrome, in HTML above the canvas: room indicator, wall text,
 * work navigation and the contextual actions of the current phase.
 */
export function GalleryOverlay({ placed }: GalleryOverlayProps) {
  const state = useGallery();
  const visible = state.phase === 'visiting' || state.phase === 'focus';
  const index = state.focusedIndex ?? state.activeIndex;
  const current = artworks[index] ?? artworks[0];
  if (!current) {
    return null;
  }
  const room = roomOf(current);
  const total = artworks.length;
  const nextZoom = ZOOM_LEVELS[(state.zoomLevel + 1) % ZOOM_LEVELS.length] ?? 1;
  const zoomLabel =
    state.zoomLevel === ZOOM_LEVELS.length - 1
      ? 'Vue d’ensemble'
      : `Observer de près · ${String(nextZoom)}×`;

  return (
    <div
      className={styles.chrome}
      data-visible={visible ? 'true' : 'false'}
      aria-hidden={!visible}
    >
      <header className={styles.topBar}>
        <p className={styles.wordmark}>LOVA</p>
        <div className={styles.roomIndicator}>
          <span className={styles.roomLabel}>
            Salle {pad(room.number)} sur {pad(rooms.length)} · {room.label}
          </span>
          <span className={styles.progress} aria-hidden="true">
            {rooms.map((entry) => (
              <i
                key={entry.id}
                className={entry.id === room.id ? styles.dotActive : styles.dot}
              />
            ))}
          </span>
        </div>
        <button
          type="button"
          className={styles.pill}
          onClick={() => {
            galleryStore.leave();
          }}
        >
          Quitter la visite
        </button>
      </header>

      <section
        className={styles.wallText}
        data-dimmed={state.phase === 'focus' ? 'true' : 'false'}
        aria-labelledby="gallery-room-title"
      >
        <p className={styles.eyebrow}>{room.eyebrow}</p>
        <h1 id="gallery-room-title" className={styles.roomTitle}>
          {room.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className={styles.subtitle}>{room.subtitle}</p>
        <div className={styles.paragraphs}>
          {room.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <footer className={styles.bottomBar}>
        <nav className={styles.rooms} aria-label="Salles">
          {rooms.map((entry) => {
            const firstWork = placed.find(
              (item) => artworks[item.index]?.room === entry.id,
            );
            const isCurrent = entry.id === room.id;
            return (
              <button
                key={entry.id}
                type="button"
                className={isCurrent ? styles.roomLinkActive : styles.roomLink}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  if (firstWork) {
                    goToWork(placed, firstWork.index);
                  }
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </nav>

        <div className={styles.navCapsule}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Œuvre précédente"
            disabled={index === 0}
            onClick={() => {
              stepWork(placed, -1);
            }}
          >
            <ArrowLeftIcon />
          </button>
          <span className={styles.navLabel} aria-live="polite">
            Œuvre {formatIndex(index, total)}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Œuvre suivante"
            disabled={index === total - 1}
            onClick={() => {
              stepWork(placed, 1);
            }}
          >
            <ArrowRightIcon />
          </button>
        </div>

        <div className={styles.actions}>
          {state.phase === 'focus' ? (
            <>
              {current.kind === 'sculpture' ? (
                <button
                  type="button"
                  className={styles.pill}
                  aria-pressed={state.inspecting}
                  onClick={() => {
                    galleryStore.toggleInspect();
                  }}
                >
                  <RotateIcon />
                  {state.inspecting
                    ? 'Terminer la manipulation'
                    : 'Manipuler en 3D'}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.pill}
                onClick={() => {
                  galleryStore.zoomStep();
                }}
              >
                <ZoomIcon />
                {zoomLabel}
              </button>
              <button
                type="button"
                className={styles.pillQuiet}
                onClick={() => {
                  galleryStore.unfocus();
                }}
              >
                Retour à la salle · Échap
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.pill}
              onClick={() => {
                galleryStore.focus(state.activeIndex);
              }}
            >
              <ZoomIcon />
              Observer de près
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
