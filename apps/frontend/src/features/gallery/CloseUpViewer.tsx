import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { useRef, useState } from 'react';
import { MediaImage } from '../../components/media-image/MediaImage';
import type { Artwork } from './data/rooms';
import styles from './CloseUpViewer.module.css';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface View {
  scale: number;
  x: number;
  y: number;
}

interface PointerState {
  id: number;
  x: number;
  y: number;
}

export interface CloseUpViewerProps {
  artwork: Artwork;
  titleId: string;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * "Observer de près": the artwork full screen on black. Zoom with the wheel,
 * a pinch or a double click, pan by dragging. Escape closes it (handled by the
 * dialog). No mockup exists yet, so the layout is deliberately plain.
 */
export function CloseUpViewer({
  artwork,
  titleId,
  onClose,
}: CloseUpViewerProps) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, PointerState>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const zoomAround = (
    factor: number,
    originX: number,
    originY: number,
  ): void => {
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      if (scale === MIN_SCALE) {
        return { scale, x: 0, y: 0 };
      }
      const ratio = scale / current.scale;
      return {
        scale,
        x: originX - (originX - current.x) * ratio,
        y: originY - (originY - current.y) * ratio,
      };
    });
  };

  const relativeOrigin = (event: {
    clientX: number;
    clientY: number;
    currentTarget: Element;
  }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    };
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    const origin = relativeOrigin(event);
    zoomAround(event.deltaY < 0 ? 1.15 : 1 / 1.15, origin.x, origin.y);
  };

  const handleDoubleClick = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    const origin = relativeOrigin(event);
    if (view.scale > MIN_SCALE) {
      setView({ scale: 1, x: 0, y: 0 });
    } else {
      zoomAround(2.5, origin.x, origin.y);
    }
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a !== undefined && b !== undefined) {
        pinchStart.current = {
          distance: Math.hypot(b.x - a.x, b.y - a.y),
          scale: view.scale,
        };
      }
    }
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    const previous = pointers.current.get(event.pointerId);
    if (previous === undefined) {
      return;
    }
    const next = { id: event.pointerId, x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);

    if (pointers.current.size === 2 && pinchStart.current !== null) {
      const [a, b] = [...pointers.current.values()];
      if (a !== undefined && b !== undefined) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const target = clamp(
          (distance / pinchStart.current.distance) * pinchStart.current.scale,
          MIN_SCALE,
          MAX_SCALE,
        );
        setView((current) => ({ ...current, scale: target }));
      }
      return;
    }
    if (view.scale > MIN_SCALE) {
      setView((current) => ({
        ...current,
        x: current.x + next.x - previous.x,
        y: current.y + next.y - previous.y,
      }));
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
  };

  return (
    <div className={styles.viewer}>
      <header className={styles.bar}>
        <p id={titleId} className={styles.title}>
          {artwork.title}{' '}
          <span className={styles.meta}>· {artwork.technique}</span>
        </p>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            onClick={() => {
              zoomAround(1 / 1.3, 0, 0);
            }}
            aria-label="Réduire"
          >
            −
          </button>
          <span className={styles.zoom} aria-live="polite">
            {Math.round(view.scale * 100)} %
          </span>
          <button
            type="button"
            className={styles.control}
            onClick={() => {
              zoomAround(1.3, 0, 0);
            }}
            aria-label="Agrandir"
          >
            +
          </button>
          <button type="button" className={styles.close} onClick={onClose}>
            Fermer
          </button>
        </div>
      </header>
      <div
        className={styles.canvas}
        data-zoomed={view.scale > MIN_SCALE ? '' : undefined}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className={styles.imageWrap}
          style={{
            transform: `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.scale)})`,
          }}
        >
          <MediaImage
            className={styles.image}
            image={artwork.image}
            alt={artwork.alt}
            sizes="100vw"
            priority
          />
        </div>
      </div>
      <p className={styles.hint}>
        Molette ou pincement pour zoomer, glisser pour déplacer, Échap pour
        sortir.
      </p>
    </div>
  );
}
