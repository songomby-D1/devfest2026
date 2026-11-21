export type ViewerStatus = 'loading' | 'ready' | 'error';
export type ModelQuality = 'standard' | 'hd';

export interface ViewerState {
  status: ViewerStatus;
  quality: ModelQuality;
  hdAvailable: boolean;
  hdFailed: boolean;
  attempt: number;
}

export type ViewerAction =
  | { type: 'loaded' }
  | { type: 'failed' }
  | { type: 'toggleHd' }
  | { type: 'retry' };

export function initialViewerState(hdAvailable: boolean): ViewerState {
  return {
    status: 'loading',
    quality: 'standard',
    hdAvailable,
    hdFailed: false,
    attempt: 0,
  };
}

export function viewerReducer(
  state: ViewerState,
  action: ViewerAction,
): ViewerState {
  switch (action.type) {
    case 'loaded':
      return { ...state, status: 'ready' };
    case 'failed':
      if (state.quality === 'hd') {
        return {
          ...state,
          status: 'loading',
          quality: 'standard',
          hdAvailable: false,
          hdFailed: true,
        };
      }
      return { ...state, status: 'error' };
    case 'toggleHd':
      if (!state.hdAvailable) return state;
      return {
        ...state,
        status: 'loading',
        quality: state.quality === 'hd' ? 'standard' : 'hd',
      };
    case 'retry':
      return {
        ...state,
        status: 'loading',
        quality: 'standard',
        attempt: state.attempt + 1,
      };
  }
}

export function statusMessage(state: ViewerState): string {
  if (state.status === 'error') {
    return 'Le modèle 3D n’a pas pu être chargé.';
  }
  if (state.status === 'loading') {
    return state.quality === 'hd'
      ? 'Chargement de la version HD…'
      : 'Chargement du modèle 3D…';
  }
  return state.hdFailed
    ? 'La version HD n’est pas disponible, affichage en qualité standard.'
    : '';
}
