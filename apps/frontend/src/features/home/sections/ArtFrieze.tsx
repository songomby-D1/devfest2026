import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import { MediaImage } from '../../../components/media-image/MediaImage';
import { cx } from '../../../lib/cx';
import type { ImageSource } from '../../../lib/media/media';
import { useReducedMotion } from '../../../lib/motion/reduced-motion';
import { Link } from '../../../lib/router/Link';
import styles from './ArtFrieze.module.css';
import { useScrollScene, wideViewport } from './useScrollScene';

export interface FriezePiece {
  id: string;
  title: string;
  artist: string;
  technique: string;
  period: string;
  room: string;
  story: string;
  image: ImageSource;
  alt: string;
}

export interface ArtFriezeProps {
  pieces: readonly FriezePiece[];
  scrollerRef: RefObject<HTMLElement | null>;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function excerpt(text: string, max = 170): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/**
 * The landing's "art immersif" frieze, built from the published collection:
 * the page scrolls down, the works slide sideways under a warm spotlight, the
 * nearest one comes into focus. The last card invites a contribution.
 * Reduced motion and small screens get a plain list.
 */
export function ArtFrieze({ pieces, scrollerRef }: ArtFriezeProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const distance = useRef(0);
  const reducedMotion = useReducedMotion();
  const [pinned] = useState(() => wideViewport());
  const enabled = pinned && !reducedMotion;

  const onResize = useCallback(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (section === null || stage === null || track === null) return;
    distance.current = Math.max(0, track.scrollWidth - stage.clientWidth);
    section.style.height = `${String(stage.clientHeight + distance.current)}px`;
  }, []);

  const onFrame = useCallback(({ progress }: { progress: number }) => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (section === null || track === null || stage === null) return;
    track.style.transform = `translate3d(${String(-progress * distance.current)}px, 0, 0)`;
    section.style.setProperty('--p', progress.toFixed(4));
    const middle = stage.clientWidth * 0.55;
    for (const piece of track.children) {
      if (!(piece instanceof HTMLElement)) continue;
      const rect = piece.getBoundingClientRect();
      const offset = Math.abs(rect.left + rect.width / 2 - middle);
      const focus = Math.max(0, 1 - offset / (stage.clientWidth * 0.6));
      piece.style.setProperty('--k', focus.toFixed(3));
    }
  }, []);

  useScrollScene(scrollerRef, sectionRef, { onFrame, onResize, enabled });

  const count = pieces.length;
  return (
    <section
      ref={sectionRef}
      className={styles.art}
      data-pinned={enabled ? 'true' : 'false'}
      aria-labelledby="art-title"
    >
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.spot} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.tag}>Art immersif</span>
          <h2 id="art-title" className={styles.title}>
            Le musée,
            <br />
            œuvre après œuvre
          </h2>
          <p className={styles.lead}>
            Les œuvres publiées sur LOVA, relues par des humains. Ouvrez une
            notice pour voir l’œuvre de près, ses sources et son certificat.
          </p>
        </div>

        <div ref={trackRef} className={styles.track}>
          {pieces.map((piece, index) => (
            <article key={piece.id} className={styles.piece}>
              <span className={styles.ghost} aria-hidden="true">
                {piece.room}
              </span>
              <Link
                to={`/oeuvre/${piece.id}`}
                className={styles.frame}
                aria-label={`Ouvrir la notice : ${piece.title}`}
              >
                <MediaImage
                  className={styles.image}
                  image={piece.image}
                  alt={piece.alt}
                  sizes="(max-width: 760px) 84vw, 30vw"
                />
              </Link>
              <div className={styles.info}>
                <span className={styles.number}>
                  {pad(index + 1)} / {pad(count)} · {piece.room}
                </span>
                <h3 className={styles.pieceTitle}>{piece.title}</h3>
                {piece.story !== '' && (
                  <p className={styles.desc}>{excerpt(piece.story)}</p>
                )}
                <dl className={styles.meta}>
                  <div>
                    <dt>Auteur</dt>
                    <dd>{piece.artist}</dd>
                  </div>
                  <div>
                    <dt>Technique</dt>
                    <dd>{piece.technique}</dd>
                  </div>
                  {piece.period !== '' && (
                    <div>
                      <dt>Période</dt>
                      <dd>{piece.period}</dd>
                    </div>
                  )}
                </dl>
                <Link to={`/oeuvre/${piece.id}`} className={styles.more}>
                  Lire la notice
                </Link>
              </div>
            </article>
          ))}

          <article className={cx(styles.piece, styles.next)}>
            <span className={styles.ghost} aria-hidden="true">
              Demain
            </span>
            <div className={styles.nextBody}>
              <svg
                className={styles.mark}
                viewBox="36 78 356 304"
                aria-hidden="true"
                focusable="false"
              >
                <use href="/brand/lova.svg#lova" />
              </svg>
              <h3 className={styles.nextTitle}>
                La prochaine œuvre
                <br />
                est peut-être chez vous
              </h3>
              <Link to="/contribuer" className={styles.nextCta}>
                Déposer une œuvre
              </Link>
            </div>
          </article>
        </div>

        <div className={styles.axis} aria-hidden="true">
          <div className={styles.line}>
            <span className={styles.fill} />
          </div>
          <ol className={styles.ticks}>
            {pieces.map((piece, index) => (
              <li
                key={piece.id}
                style={{
                  left: `${String(((index + 0.5) / (count + 1)) * 100)}%`,
                }}
              >
                {pad(index + 1)}
              </li>
            ))}
            <li
              style={{
                left: `${String(((count + 0.5) / (count + 1)) * 100)}%`,
              }}
            >
              Demain
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
