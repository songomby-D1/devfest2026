import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ModelViewerHandle } from './model-viewer-element';
import { initialViewerState, viewerReducer } from './viewer-state';

interface ArtworkViewerOptions {
  hdAvailable: boolean;
  detectWebGL: () => boolean;
  loadModelViewer: () => Promise<void>;
}

export function useArtworkViewer({
  hdAvailable,
  detectWebGL,
  loadModelViewer,
}: ArtworkViewerOptions) {
  const [webGLAvailable] = useState(detectWebGL);
  const [state, dispatch] = useReducer(
    viewerReducer,
    hdAvailable,
    initialViewerState,
  );
  const viewer = useRef<ModelViewerHandle | null>(null);

  useEffect(() => {
    if (!webGLAvailable) return;
    let active = true;
    loadModelViewer().catch(() => {
      if (active) dispatch({ type: 'failed' });
    });
    return () => {
      active = false;
    };
  }, [webGLAvailable, loadModelViewer, state.attempt]);

  const viewerRef = useCallback((element: ModelViewerHandle | null) => {
    if (!element) return;
    viewer.current = element;
    const onLoad = () => {
      dispatch({ type: 'loaded' });
    };
    const onError = () => {
      dispatch({ type: 'failed' });
    };
    element.addEventListener('load', onLoad);
    element.addEventListener('error', onError);
    return () => {
      element.removeEventListener('load', onLoad);
      element.removeEventListener('error', onError);
      viewer.current = null;
    };
  }, []);

  const showView = useCallback((orbit: string) => {
    if (viewer.current) viewer.current.cameraOrbit = orbit;
  }, []);

  return {
    state,
    webGLAvailable,
    viewerRef,
    showView,
    toggleHd: () => {
      dispatch({ type: 'toggleHd' });
    },
    retry: () => {
      dispatch({ type: 'retry' });
    },
  };
}
