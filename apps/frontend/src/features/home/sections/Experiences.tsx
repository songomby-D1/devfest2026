import { MediaImage } from '../../../components/media-image/MediaImage';
import { Link } from '../../../lib/router/Link';
import type { FriezePiece } from './ArtFrieze';
import styles from './Experiences.module.css';

const EXPERIENCES = [
  {
    to: '/musee',
    label: 'Visiter',
    title: 'Le musée, salle par salle',
    text: 'Peinture, sculpture, savoir-faire et musique : chaque œuvre sur son mur, avec sa notice et ses sources.',
  },
  {
    to: '/visite',
    label: 'Explorer',
    title: 'La visite en 3D',
    text: 'Marchez dans une galerie en volume et approchez les œuvres comme dans une vraie salle.',
  },
  {
    to: '/contribuer',
    label: 'Contribuer',
    title: 'Déposer une œuvre',
    text: 'Décrivez une œuvre, ajoutez ses photos ou ses vidéos. Elle entre dans la file de relecture.',
  },
  {
    to: '/revue',
    label: 'Relire',
    title: 'La revue humaine',
    text: 'Des relecteurs vérifient l’objet et sa description séparément, puis décident de la publication.',
  },
  {
    to: '/expositions/1?creer=1',
    label: 'Générer',
    title: 'Créer en 3D',
    text: 'Photographiez un objet : LOVA le modélise en volume et l’expose dans le couloir 3D. Connexion requise.',
  },
  {
    to: '/musee',
    label: 'Prouver',
    title: 'La provenance certifiée',
    text: 'Chaque œuvre publiée peut recevoir un certificat inscrit sur une blockchain de test, avec l’empreinte de son image.',
  },
] as const;

/** What the visitor can do, each card a real route of the app. */
export function Experiences({
  beforeNavigate,
}: {
  beforeNavigate?: (() => Promise<void>) | undefined;
}) {
  return (
    <section className={styles.work} aria-labelledby="experiences-title">
      <div className={styles.head}>
        <span className={styles.tag}>Expériences</span>
        <h2 id="experiences-title" className={styles.title}>
          Visiter, contribuer,
          <br />
          relire, prouver.
        </h2>
      </div>
      <ol className={styles.list}>
        {EXPERIENCES.map((item, index) => (
          <li key={item.label}>
            <Link
              to={item.to}
              className={styles.card}
              beforeNavigate={
                item.to === '/musee' && index === 0 ? beforeNavigate : undefined
              }
            >
              <span className={styles.number}>
                {String(index + 1).padStart(2, '0')} {item.label}
              </span>
              <span className={styles.cardTitle}>{item.title}</span>
              <span className={styles.text}>{item.text}</span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The closing sky: one last invitation, and the landing's HUD as a footer. */
export function Closing({
  beforeNavigate,
  pieces = [],
}: {
  beforeNavigate?: (() => Promise<void>) | undefined;
  /** The published works, for the ribbon of square cards above the title. */
  pieces?: readonly FriezePiece[] | undefined;
}) {
  const withImage = pieces.filter((piece) => piece.image.src !== '');
  // The ribbon loops: the list is drawn twice and slides by exactly one copy.
  const loop = withImage.length > 0 ? [...withImage, ...withImage] : [];
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <div className={styles.trails} aria-hidden="true" />
      {loop.length > 0 && (
        <div className={styles.reel}>
          <ul
            className={styles.reelTrack}
            style={{ ['--count' as string]: withImage.length }}
          >
            {loop.map((piece, index) => {
              const copy = index >= withImage.length;
              return (
                <li key={`${piece.id}-${String(index)}`} aria-hidden={copy}>
                  <Link
                    to={`/oeuvre/${piece.id}`}
                    className={styles.reelCard}
                    tabIndex={copy ? -1 : undefined}
                  >
                    <MediaImage
                      className={styles.reelImage}
                      image={piece.image}
                      alt={copy ? '' : piece.alt}
                      sizes="(max-width: 760px) 62vw, 24vw"
                    />
                    <span className={styles.reelCaption}>
                      <span>{piece.title}</span>
                      <span>{piece.room}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <h2 id="closing-title" className={styles.closingTitle}>
        L’héritage malagasy
        <br />
        prend vie.
      </h2>
      <div className={styles.closingRow}>
        <Link
          to="/musee"
          className={styles.cta}
          beforeNavigate={beforeNavigate}
        >
          Entrer dans le musée →
        </Link>
        <Link to="/contribuer" className={styles.ctaGhost}>
          Déposer une œuvre
        </Link>
      </div>
      <footer className={styles.footer}>
        <span>LOVA · Preserving the Art</span>
        <span>DevFest 2026</span>
        <span>Patrimoine malagasy</span>
      </footer>
    </section>
  );
}
