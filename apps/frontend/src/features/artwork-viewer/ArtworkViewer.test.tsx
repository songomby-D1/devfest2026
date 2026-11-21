import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ArtworkViewer } from './ArtworkViewer';
import type { ArtworkViewerProps } from './ArtworkViewer';
import type { ModelViewerHandle } from './model-viewer-element';

const MODEL_1K = '/item/model-1k.glb';
const MODEL_2K = '/item/model-2k.glb';
const POSTER = '/item/poster.webp';
const ALT = 'Sculpture en bois';

function renderViewer(overrides: Partial<ArtworkViewerProps> = {}) {
  const loadModelViewer = vi.fn(() => Promise.resolve());
  render(
    <ArtworkViewer
      poster={POSTER}
      model1k={MODEL_1K}
      model2k={MODEL_2K}
      alt={ALT}
      bottomScanned={false}
      detectWebGL={() => true}
      loadModelViewer={loadModelViewer}
      {...overrides}
    />,
  );
  return { loadModelViewer, user: userEvent.setup() };
}

function modelViewer(): ModelViewerHandle {
  const element = document.querySelector<ModelViewerHandle>('model-viewer');
  if (!element) throw new Error('model-viewer is not rendered');
  return element;
}

function dispatchModelViewerEvent(type: 'load' | 'error', detailType?: string) {
  act(() => {
    modelViewer().dispatchEvent(
      new CustomEvent(type, { detail: { type: detailType } }),
    );
  });
}

describe('ArtworkViewer', () => {
  it('renders model-viewer with the 1K model, poster and neutral tone mapping', () => {
    const { loadModelViewer } = renderViewer();

    const viewer = modelViewer();
    expect(viewer).toHaveAttribute('src', MODEL_1K);
    expect(viewer).toHaveAttribute('poster', POSTER);
    expect(viewer).toHaveAttribute('alt', ALT);
    expect(viewer).toHaveAttribute('camera-controls');
    expect(viewer).toHaveAttribute('tone-mapping', 'neutral');
    expect(viewer).not.toHaveAttribute('ar');
    expect(loadModelViewer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement du modèle 3D…',
    );
  });

  it('clears the loading message once the model has loaded', () => {
    renderViewer();

    dispatchModelViewerEvent('load');

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('hides the bottom view and limits the orbit when the bottom was not scanned', () => {
    renderViewer({ bottomScanned: false });

    const views = screen.getByRole('group', { name: 'Vues' });
    expect(views).toHaveTextContent('FaceDosGaucheDroiteDessus');
    expect(
      screen.queryByRole('button', { name: 'Dessous' }),
    ).not.toBeInTheDocument();
    expect(modelViewer()).toHaveAttribute(
      'max-camera-orbit',
      'auto 90deg auto',
    );
  });

  it('offers the bottom view without an orbit limit when the bottom was scanned', () => {
    renderViewer({ bottomScanned: true });

    expect(screen.getByRole('button', { name: 'Dessous' })).toBeVisible();
    expect(modelViewer()).not.toHaveAttribute('max-camera-orbit');
  });

  it.each([
    ['Face', '0deg 75deg auto'],
    ['Dos', '180deg 75deg auto'],
    ['Gauche', '-90deg 75deg auto'],
    ['Droite', '90deg 75deg auto'],
    ['Dessus', '0deg 0deg auto'],
    ['Dessous', '0deg 180deg auto'],
  ])('moves the camera to the %s preset', async (label, orbit) => {
    const { user } = renderViewer({ bottomScanned: true });

    await user.click(screen.getByRole('button', { name: label }));

    expect(modelViewer().cameraOrbit).toBe(orbit);
  });

  it('switches to the 2K model with the HD toggle and back', async () => {
    const { user } = renderViewer();
    dispatchModelViewerEvent('load');
    const hd = screen.getByRole('button', { name: 'Haute définition (HD)' });
    expect(hd).toHaveAttribute('aria-pressed', 'false');

    await user.click(hd);

    expect(modelViewer()).toHaveAttribute('src', MODEL_2K);
    expect(hd).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement de la version HD…',
    );

    await user.click(hd);

    expect(modelViewer()).toHaveAttribute('src', MODEL_1K);
  });

  it('has no HD toggle without a 2K model', () => {
    render(
      <ArtworkViewer
        poster={POSTER}
        model1k={MODEL_1K}
        alt={ALT}
        bottomScanned={false}
        detectWebGL={() => true}
        loadModelViewer={() => Promise.resolve()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Haute définition (HD)' }),
    ).not.toBeInTheDocument();
  });

  it.each(['loadfailure', 'webglcontextlost'])(
    'returns to the 1K model and hides HD when the 2K model fails with %s',
    async (detailType) => {
      const { user } = renderViewer();
      dispatchModelViewerEvent('load');
      await user.click(
        screen.getByRole('button', { name: 'Haute définition (HD)' }),
      );

      dispatchModelViewerEvent('error', detailType);

      expect(modelViewer()).toHaveAttribute('src', MODEL_1K);
      expect(
        screen.queryByRole('button', { name: 'Haute définition (HD)' }),
      ).not.toBeInTheDocument();

      dispatchModelViewerEvent('load');

      expect(screen.getByRole('status')).toHaveTextContent(
        'La version HD n’est pas disponible, affichage en qualité standard.',
      );
    },
  );

  it('keeps the poster and offers a retry when the 1K model fails', async () => {
    const { user, loadModelViewer } = renderViewer();

    dispatchModelViewerEvent('error', 'loadfailure');

    expect(document.querySelector('model-viewer')).toBeNull();
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute(
      'src',
      POSTER,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Le modèle 3D n’a pas pu être chargé.',
    );
    expect(
      screen.queryByRole('group', { name: 'Vues' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(modelViewer()).toHaveAttribute('src', `${MODEL_1K}#retry-1`);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement du modèle 3D…',
    );
    expect(loadModelViewer).toHaveBeenCalledTimes(2);
  });

  it('shows the error state when model-viewer itself cannot be loaded', async () => {
    renderViewer({
      loadModelViewer: () => Promise.reject(new Error('chunk failed')),
    });

    expect(
      await screen.findByRole('button', { name: 'Réessayer' }),
    ).toBeVisible();
    expect(screen.getByRole('img', { name: ALT })).toBeVisible();
  });

  it('falls back to the still poster when WebGL is unavailable', () => {
    const { loadModelViewer } = renderViewer({ detectWebGL: () => false });

    expect(document.querySelector('model-viewer')).toBeNull();
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute(
      'src',
      POSTER,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'La 3D n’est pas disponible sur cet appareil.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(loadModelViewer).not.toHaveBeenCalled();
  });
});
