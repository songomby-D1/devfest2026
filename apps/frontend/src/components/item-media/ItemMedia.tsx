import { useState } from 'react';
import type { MediaRef } from '../../lib/api';
import styles from './ItemMedia.module.css';

export interface ItemMediaProps {
  media: readonly MediaRef[];
  title: string;
}

function MediaFigure({ media, title }: { media: MediaRef; title: string }) {
  const [failed, setFailed] = useState(false);
  const label = media.caption ?? title;
  if (failed) {
    return (
      <figure className={styles.figure}>
        <span role="img" aria-label={label} className={styles.missing}>
          Média indisponible
        </span>
        {media.caption !== null && <figcaption>{media.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={styles.figure}>
      {media.kind === 'image' ? (
        <img
          className={styles.media}
          src={media.url}
          alt={label}
          loading="lazy"
          decoding="async"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- FE-03 (#70): MediaRef carries no caption track yet (contract need).
        <video
          className={styles.media}
          src={media.url}
          controls
          preload="metadata"
          aria-label={label}
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      {media.caption !== null && <figcaption>{media.caption}</figcaption>}
    </figure>
  );
}

/** The images and videos of an item, served by the gateway, with a missing-media state. */
export function ItemMedia({ media, title }: ItemMediaProps) {
  if (media.length === 0) {
    return (
      <div
        className={styles.empty}
        role="img"
        aria-label={`${title} : aucun média`}
      >
        Aucun média pour cette œuvre.
      </div>
    );
  }
  return (
    <div className={styles.grid}>
      {media.map((entry) => (
        <MediaFigure key={entry.id} media={entry} title={title} />
      ))}
    </div>
  );
}
