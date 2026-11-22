import type { CSSProperties } from 'react';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import type { ImageSource } from '../../lib/media/media';
import styles from './MediaImage.module.css';

export interface MediaImageProps {
  image: ImageSource;
  alt: string;
  sizes: string;
  className?: string | undefined;
  /** Loads eagerly with high priority, for images visible on arrival. */
  priority?: boolean | undefined;
  /** CSS object-position, to choose the visible part of a cropped image. */
  objectPosition?: string | undefined;
  /** Called once when the file cannot be loaded. */
  onMissing?: (() => void) | undefined;
}

function MediaImageContent({
  image,
  alt,
  sizes,
  className,
  priority = false,
  objectPosition,
  onMissing,
}: MediaImageProps) {
  const [missing, setMissing] = useState(false);

  // An item without an image has an empty source: same neutral state as a missing file.
  if (missing || image.src === '') {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cx(styles.missing, className)}
        data-missing-media=""
      />
    );
  }

  const style: CSSProperties | undefined =
    objectPosition === undefined ? undefined : { objectPosition };

  return (
    <img
      className={className}
      style={style}
      src={image.src}
      srcSet={image.srcSet === '' ? undefined : image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      onError={() => {
        setMissing(true);
        onMissing?.();
      }}
    />
  );
}

/**
 * Shows a cultural image. When the local file is absent (media is not in Git
 * until D18), it renders a neutral, labeled placeholder instead.
 */
export function MediaImage(props: MediaImageProps) {
  return <MediaImageContent key={props.image.src} {...props} />;
}
