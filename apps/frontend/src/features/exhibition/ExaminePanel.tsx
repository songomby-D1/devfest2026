import { useEffect, useRef, useState } from 'react';
import { loadModelViewer } from '../artwork-viewer/load-model-viewer';
import type { ModelViewerHandle } from '../artwork-viewer/model-viewer-element';
import type { Chapter } from './exhibition-content';
import styles from './ExhibitionPage.module.css';
import { Sheet } from './Sheet';

interface ExaminePanelProps {
  readonly chapter: Chapter;
  readonly reducedMotion: boolean;
  readonly onClose: () => void;
}

/**
 * The close-up from the Haj'Aina exhibition: Google's <model-viewer> with
 * free camera, slow auto-rotation and AR on supported phones.
 */
export function ExaminePanel({
  chapter,
  reducedMotion,
  onClose,
}: ExaminePanelProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const viewer = useRef<ModelViewerHandle>(null);

  useEffect(() => {
    let cancelled = false;
    loadModelViewer().then(
      () => {
        if (!cancelled) setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const element = viewer.current;
    if (element === null) return undefined;
    const onError = (): void => {
      setStatus('error');
    };
    element.addEventListener('error', onError);
    return () => {
      element.removeEventListener('error', onError);
    };
  }, [status]);

  return (
    <Sheet label={`Examiner ${chapter.title}`} side="center" onClose={onClose}>
      <div className={styles.examine}>
        <header className={styles.sheetHeader}>
          <p className={styles.eyebrow}>{chapter.eyebrow}</p>
          <h2 className={styles.sheetTitle}>{chapter.title}</h2>
          <p className={styles.sheetMeta}>{chapter.material}</p>
        </header>
        <div className={styles.examineStage}>
          {status === 'ready' ? (
            <model-viewer
              ref={viewer}
              className={styles.modelViewer}
              src={chapter.model}
              alt={`Modèle 3D : ${chapter.title}, ${chapter.material}`}
              {...(chapter.poster === null ? {} : { poster: chapter.poster })}
              camera-controls
              auto-rotate={!reducedMotion}
              rotation-speed="20deg"
              shadow-intensity="1"
              exposure="1.05"
              tone-mapping="neutral"
              ar
              ar-modes="webxr scene-viewer quick-look"
            />
          ) : null}
          {status === 'loading' ? (
            <p className={styles.examineStatus} role="status">
              Chargement de la visionneuse…
            </p>
          ) : null}
          {status === 'error' ? (
            <p className={styles.examineStatus} role="alert">
              La 3D n’a pas pu s’afficher sur cet appareil.
            </p>
          ) : null}
        </div>
        <p className={styles.sheetHint}>
          Faites glisser pour tourner autour, pincez ou molette pour zoomer. Sur
          mobile, le bouton AR place l’objet chez vous.
        </p>
        <p className={styles.credit}>{chapter.credit}</p>
      </div>
    </Sheet>
  );
}
