import { useState } from 'react';
import { MediaImage } from '../../components/media-image/MediaImage';
import { WoodFrame } from '../../components/wood-frame/WoodFrame';
import { cx } from '../../lib/cx';
import { Link } from '../../lib/router/Link';
import styles from './Exhibit.module.css';
import type { HomeExhibit } from './home-content';

export interface ExhibitProps {
  exhibit: HomeExhibit;
  /** Positions the figure on the 1440x900 stage. */
  className?: string | undefined;
  /** Exit played before navigating into the museum. */
  beforeNavigate?: (() => Promise<void>) | undefined;
}

/*
 * Layers keep motions independent:
 * - the figure takes the intro and exit transforms;
 * - [data-parallax] takes the cursor parallax;
 * - .lift takes the hover and focus lift, in CSS;
 * - [data-anim="reveal"] and [data-anim="image"] take the curtain reveal.
 */
export function Exhibit({ exhibit, className, beforeNavigate }: ExhibitProps) {
  const isFrame = exhibit.kind === 'frame';
  // An object photographed on white has nothing to show when its file is absent.
  const [missing, setMissing] = useState(false);

  return (
    <figure
      className={cx(
        styles.exhibit,
        isFrame ? styles.frame : styles.object,
        className,
      )}
      data-anim="exhibit"
      data-reveal=""
      data-kind={exhibit.kind}
      data-side={exhibit.side}
      data-depth={String(exhibit.depth)}
      hidden={missing && !isFrame}
    >
      <div className={styles.parallax} data-parallax="">
        <Link
          to={exhibit.to}
          className={styles.link}
          beforeNavigate={beforeNavigate}
        >
          <div className={styles.lift}>
            {isFrame ? (
              <div className={styles.reveal} data-anim="reveal">
                <WoodFrame className={styles.woodFrame}>
                  <div className={styles.imageWrap} data-anim="image">
                    <MediaImage
                      className={styles.frameImage}
                      image={exhibit.image}
                      alt={exhibit.alt}
                      sizes="(max-width: 767px) 32vw, 14vw"
                      objectPosition={exhibit.focalPoint}
                      priority
                    />
                  </div>
                </WoodFrame>
              </div>
            ) : (
              <>
                <MediaImage
                  className={styles.objectImage}
                  image={exhibit.image}
                  alt={exhibit.alt}
                  sizes="20vw"
                  priority
                  onMissing={() => {
                    setMissing(true);
                  }}
                />
                <span
                  className={styles.contactShadow}
                  data-anim="shadow"
                  aria-hidden="true"
                />
              </>
            )}
          </div>
          <span className="visually-hidden">
            Voir la salle {exhibit.roomName}
          </span>
        </Link>
      </div>
      <figcaption className={styles.cartel} data-parallax="">
        <span className={styles.cartelTitle}>{exhibit.title}</span>
        <span className={styles.cartelRegion}>{exhibit.region}</span>
      </figcaption>
    </figure>
  );
}
