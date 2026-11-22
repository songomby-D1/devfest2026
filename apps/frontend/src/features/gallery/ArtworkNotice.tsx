import { ClaimStatuses } from '../../components/claim-statuses/ClaimStatuses';
import { Link } from '../../lib/router/Link';
import type { Artwork, Room } from './data/rooms';
import styles from './ArtworkNotice.module.css';

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

      <dl className={styles.details}>
        {artwork.details.map(([label, value]) => (
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

      <ClaimStatuses
        claims={artwork.claims}
        reviews={artwork.reviews}
        headingLevel={3}
      />
      <p className={styles.rights}>{artwork.rights}</p>
      <Link
        to={`/oeuvre/${encodeURIComponent(artwork.id)}`}
        className={styles.more}
      >
        Voir la fiche complète de l’œuvre
      </Link>
    </article>
  );
}
