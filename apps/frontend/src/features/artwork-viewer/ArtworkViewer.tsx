import { useId } from 'react';
import './ArtworkViewer.css';
import { loadModelViewer as defaultLoadModelViewer } from './load-model-viewer';
import { modelSource } from './model-source';
import { useArtworkViewer } from './use-artwork-viewer';
import { statusMessage } from './viewer-state';
import { HIDDEN_BOTTOM_MAX_ORBIT, viewPresets } from './views';
import { isWebGLAvailable } from './webgl';

export interface ArtworkViewerProps {
  poster: string;
  model1k: string;
  model2k?: string;
  alt: string;
  bottomScanned: boolean;
  detectWebGL?: () => boolean;
  loadModelViewer?: () => Promise<void>;
}

const WEBGL_UNAVAILABLE_MESSAGE =
  'La 3D n’est pas disponible sur cet appareil. Voici une photo de l’œuvre.';

export function ArtworkViewer({
  poster,
  model1k,
  model2k,
  alt,
  bottomScanned,
  detectWebGL = isWebGLAvailable,
  loadModelViewer = defaultLoadModelViewer,
}: ArtworkViewerProps) {
  const viewsLabelId = useId();
  const { state, webGLAvailable, viewerRef, showView, toggleHd, retry } =
    useArtworkViewer({
      hdAvailable: model2k !== undefined,
      detectWebGL,
      loadModelViewer,
    });

  if (!webGLAvailable) {
    return (
      <section className="artwork-viewer" aria-label="Visionneuse 3D">
        <div className="artwork-viewer__stage">
          <img className="artwork-viewer__poster" src={poster} alt={alt} />
        </div>
        <p className="artwork-viewer__status" role="status">
          {WEBGL_UNAVAILABLE_MESSAGE}
        </p>
      </section>
    );
  }

  const failed = state.status === 'error';
  const source = modelSource(
    state.quality === 'hd' && model2k ? model2k : model1k,
    state.attempt,
  );

  return (
    <section className="artwork-viewer" aria-label="Visionneuse 3D">
      <div
        className="artwork-viewer__stage"
        aria-busy={state.status === 'loading'}
      >
        {failed ? (
          <img className="artwork-viewer__poster" src={poster} alt={alt} />
        ) : (
          <model-viewer
            key={state.attempt}
            ref={viewerRef}
            className="artwork-viewer__model"
            src={source}
            poster={poster}
            alt={alt}
            camera-controls
            tone-mapping="neutral"
            {...(bottomScanned
              ? {}
              : { 'max-camera-orbit': HIDDEN_BOTTOM_MAX_ORBIT })}
          />
        )}
        {state.status === 'loading' && (
          <span className="artwork-viewer__spinner" aria-hidden="true" />
        )}
      </div>

      <p className="artwork-viewer__status" role="status">
        {statusMessage(state)}
      </p>

      {failed ? (
        <button
          type="button"
          className="artwork-viewer__button artwork-viewer__button--primary"
          onClick={retry}
        >
          Réessayer
        </button>
      ) : (
        <div className="artwork-viewer__controls">
          <div
            className="artwork-viewer__views"
            role="group"
            aria-labelledby={viewsLabelId}
          >
            <span id={viewsLabelId} className="artwork-viewer__label">
              Vues
            </span>
            {viewPresets(bottomScanned).map((view) => (
              <button
                key={view.id}
                type="button"
                className="artwork-viewer__button"
                onClick={() => {
                  showView(view.orbit);
                }}
              >
                {view.label}
              </button>
            ))}
          </div>
          {state.hdAvailable && (
            <button
              type="button"
              className="artwork-viewer__button artwork-viewer__button--toggle"
              aria-pressed={state.quality === 'hd'}
              aria-label="Haute définition (HD)"
              onClick={toggleHd}
            >
              HD
            </button>
          )}
        </div>
      )}
    </section>
  );
}
