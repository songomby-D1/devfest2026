import styles from './GalleryExperience.module.css';
import { LongArrowIcon } from './GalleryIcons';
import { galleryStore } from './gallery-store';

interface GalleryEntranceProps {
  /** True while the travelling has started and the screen fades away. */
  readonly leaving: boolean;
}

/**
 * The entrance: the white vestibule of the Figma home, reduced to its title,
 * its promise and the door into the room. The 3D scene is already running
 * behind it, dark, so the first frame after the door opens is instant.
 */
export function GalleryEntrance({ leaving }: GalleryEntranceProps) {
  return (
    <section
      className={styles.entrance}
      data-leaving={leaving ? 'true' : 'false'}
      aria-labelledby="gallery-entrance-title"
    >
      <div className={styles.entranceBar}>
        <p className={styles.entranceWordmark}>LOVA</p>
        <p className={styles.entranceNote}>Musée numérique · démonstration</p>
      </div>
      <div className={styles.entranceBody}>
        <h1 id="gallery-entrance-title" className={styles.entranceTitle}>
          <span>L’art malagasy, </span>
          <span>à portée </span>
          <span className={styles.entranceAccent}>de regard.</span>
        </h1>
        <p className={styles.entranceLead}>
          Peintures, sculptures, savoir-faire et musiques de Madagascar, à
          parcourir comme un véritable musée.
        </p>
        <button
          type="button"
          className={styles.enterButton}
          disabled={leaving}
          onClick={() => {
            galleryStore.enter();
          }}
        >
          Entrer dans le musée
          <LongArrowIcon />
        </button>
        <p className={styles.entranceHint}>
          Flèches ou molette pour longer le mur · clic sur une œuvre pour
          l’approcher · Échap pour revenir
        </p>
      </div>
    </section>
  );
}
