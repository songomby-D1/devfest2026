import { useEffect, useId, useState } from 'react';
import { api, type ApiClient, type Model3d } from '../../lib/api';
// The viewer is reused as is (ADR 0001: poster, 1K first, 2K on demand).
import { ArtworkViewer } from '../artwork-viewer';
import styles from './Model3dPanel.module.css';

export interface Model3dPanelProps {
  contentId: string;
  /** Describes the item for the poster and the model. */
  alt?: string;
  /** Still image shown while the model is in preparation or unavailable. */
  fallbackImageUrl?: string | null;
  /** Shows the bottom view only when the bottom was scanned. */
  bottomScanned?: boolean;
  client?: ApiClient;
  /** Test seams, passed to the viewer. */
  detectWebGL?: () => boolean;
  loadModelViewer?: () => Promise<void>;
}

type PanelState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; model: Model3d };

/**
 * 3D view of an item, per ADR 0001: `ready` starts the viewer with the poster
 * and the 1K model, HD (2K) on request; `processing` says the model is being
 * prepared; `missing` renders nothing so the item keeps its media only. An
 * error keeps the page usable and falls back to the still image when given.
 */
export function Model3dPanel({
  contentId,
  alt = 'Modèle 3D de l’œuvre',
  fallbackImageUrl = null,
  bottomScanned = false,
  client = api,
  detectWebGL,
  loadModelViewer,
}: Model3dPanelProps) {
  const headingId = useId();
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    client.getModel3d(contentId).then(
      (model) => {
        if (!cancelled) setState({ kind: 'loaded', model });
      },
      () => {
        if (!cancelled) setState({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, contentId]);

  if (state.kind === 'loading') return null;

  const model = state.kind === 'loaded' ? state.model : null;
  if (model?.status === 'missing') return null;
  if (model === null && !fallbackImageUrl) return null;

  const fallback = fallbackImageUrl ? (
    <img className={styles.still} src={fallbackImageUrl} alt={alt} />
  ) : null;

  let body;
  if (model?.status === 'ready' && model.variants) {
    body = (
      <ArtworkViewer
        poster={model.variants.poster}
        model1k={model.variants.glb1k}
        model2k={model.variants.glb2k}
        alt={alt}
        bottomScanned={bottomScanned}
        {...(detectWebGL ? { detectWebGL } : {})}
        {...(loadModelViewer ? { loadModelViewer } : {})}
      />
    );
  } else if (model?.status === 'processing') {
    body = (
      <>
        {fallback}
        <p className={styles.message} role="status">
          Le modèle 3D de cette œuvre est en préparation.
        </p>
      </>
    );
  } else {
    body = (
      <>
        {fallback}
        <p className={styles.message} role="status">
          La vue 3D est momentanément indisponible. Voici une photo de l’œuvre.
        </p>
      </>
    );
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      data-status={model?.status ?? 'error'}
    >
      <h2 id={headingId} className={styles.heading}>
        Vue 3D
      </h2>
      {body}
    </section>
  );
}
