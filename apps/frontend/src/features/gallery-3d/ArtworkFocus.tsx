import { CloseIcon } from './GalleryIcons';
import styles from './GalleryOverlay.module.css';
import { artworks, formatIndex, formatSize } from './gallery-content';
import { galleryStore, useGallery } from './gallery-store';

/**
 * The notice that opens beside a focused work. It stays in the DOM so the
 * text is crisp, selectable and readable by assistive technology, and it
 * never covers the work itself.
 */
export function ArtworkFocus() {
  const state = useGallery();
  if (state.phase !== 'focus' || state.focusedIndex === null) {
    return null;
  }
  const work = artworks[state.focusedIndex];
  if (!work) {
    return null;
  }
  const credit = work.credit;
  const mediaMissing = state.media[work.id] === 'missing';

  return (
    <aside
      className={styles.notice}
      role="dialog"
      aria-labelledby="gallery-notice-title"
      aria-describedby="gallery-notice-text"
    >
      <div className={styles.noticeHeader}>
        <p className={styles.eyebrowInk}>
          Notice · {formatIndex(state.focusedIndex)}
        </p>
        <button
          type="button"
          className={styles.closeButton}
          onClick={() => {
            galleryStore.unfocus();
          }}
        >
          Fermer
          <CloseIcon />
        </button>
      </div>

      <p className={work.demo ? styles.badgeDemo : styles.badgeHeritage}>
        {work.demo
          ? 'Objet de démonstration · contenu fictif'
          : 'Œuvre patrimoniale · reproduction libre de droits'}
      </p>

      <h2 id="gallery-notice-title" className={styles.noticeTitle}>
        {work.title}
      </h2>
      <p className={styles.noticeArtist}>{work.artist}</p>

      <dl className={styles.facts}>
        <div>
          <dt>Technique</dt>
          <dd>{work.medium}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{formatSize(work)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{work.date}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{work.place}</dd>
        </div>
        <div>
          <dt>Droits</dt>
          <dd>
            {credit.source === 'Wikimedia Commons' ? (
              <>
                {credit.license} · {credit.author} ·{' '}
                <a href={credit.page} target="_blank" rel="noreferrer">
                  Wikimedia Commons
                </a>
              </>
            ) : (
              credit.note
            )}
          </dd>
        </div>
      </dl>

      {mediaMissing ? (
        <p className={styles.mediaWarning}>
          Image indisponible dans cette démonstration : le fichier local n’a pas
          été trouvé.
        </p>
      ) : null}

      <p className={styles.sectionLabel}>Le récit</p>
      <p id="gallery-notice-text" className={styles.noticeText}>
        {work.description}
      </p>

      <p className={styles.hint}>
        {work.kind === 'sculpture'
          ? 'Manipuler en 3D, puis glisser pour faire tourner l’objet. Échap pour revenir à la salle.'
          : 'Observer de près pour approcher la toile. Échap pour revenir à la salle.'}
      </p>
    </aside>
  );
}
