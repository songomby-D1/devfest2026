import type { Artwork, Room, VerificationStatus } from './data/rooms';
import styles from './ArtworkNotice.module.css';

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: 'Informations vérifiées',
  unreviewed: 'Informations non relues',
  uncertain: 'Informations incertaines',
};

export interface ArtworkNoticeProps {
  room: Room;
  artwork: Artwork;
  titleId: string;
  onClose: () => void;
}

/** The notice opened from the wall label. No mockup exists yet: a sober, readable layout. */
export function ArtworkNotice({
  room,
  artwork,
  titleId,
  onClose,
}: ArtworkNoticeProps) {
  const details: readonly [string, string][] = [
    ['Artiste', artwork.artist],
    ['Technique', artwork.technique],
    ['Dimensions', artwork.dimensions],
    ['Région', artwork.region],
    ['Provenance', artwork.provenance],
  ];

  return (
    <article className={styles.notice}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          Salle {room.number} · {room.name} · Œuvre {artwork.number}
        </p>
        <h2 id={titleId} className={styles.title}>
          {artwork.title}
        </h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Fermer la notice"
        >
          ×
        </button>
      </header>

      {artwork.isDemo && (
        <p className={styles.demo} role="note">
          Œuvre de démonstration. Elle illustre le parcours et ne fait pas
          partie de la collection.
        </p>
      )}

      <dl className={styles.details}>
        {details.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className={styles.story} aria-label="Récit">
        {artwork.story.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      <p className={styles.verification} data-status={artwork.verification}>
        {VERIFICATION_LABEL[artwork.verification]}
      </p>
      <p className={styles.rights}>{artwork.rights}</p>
    </article>
  );
}
