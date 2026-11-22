import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../../lib/api';
import { fixtureIds } from '../../lib/api/fixtures';
import { createMockClient } from '../../lib/api/mock-client';
import { Model3dPanel } from './Model3dPanel';

const STILL = '/media/still.webp';

function clientWith(getModel3d?: ApiClient['getModel3d']): ApiClient {
  const base = createMockClient();
  return getModel3d ? { ...base, getModel3d } : base;
}

async function renderPanel(
  contentId: string,
  client: ApiClient,
  fallbackImageUrl: string | null = STILL,
) {
  const loadModelViewer = vi.fn(() => Promise.resolve());
  const view = render(
    <Model3dPanel
      contentId={contentId}
      alt="Aloalo sculpté"
      fallbackImageUrl={fallbackImageUrl}
      client={client}
      detectWebGL={() => true}
      loadModelViewer={loadModelViewer}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { ...view, loadModelViewer };
}

describe('Model3dPanel', () => {
  it('starts the viewer with the poster and the 1K model, HD on demand', async () => {
    const { loadModelViewer } = await renderPanel(
      fixtureIds.sculpture,
      clientWith(),
    );

    expect(screen.getByRole('heading', { name: 'Vue 3D' })).toBeInTheDocument();
    const viewer = document.querySelector('model-viewer');
    expect(viewer).toHaveAttribute('src', '/demo/sculpture/model-1k.glb');
    expect(viewer).toHaveAttribute('poster', '/demo/sculpture/poster.webp');
    expect(viewer).toHaveAttribute('alt', 'Aloalo sculpté');
    expect(
      screen.getByRole('button', { name: 'Haute définition (HD)' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(loadModelViewer).toHaveBeenCalledTimes(1);
  });

  it('shows the still image and a preparation message while processing', async () => {
    await renderPanel(fixtureIds.textile, clientWith());

    expect(screen.getByRole('status')).toHaveTextContent('en préparation');
    expect(screen.getByRole('img', { name: 'Aloalo sculpté' })).toHaveAttribute(
      'src',
      STILL,
    );
    expect(document.querySelector('model-viewer')).toBeNull();
  });

  it('renders nothing when the item has no 3D model', async () => {
    const { container } = await renderPanel(fixtureIds.painting, clientWith());
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to the still image when the descriptor cannot be read', async () => {
    const failing = () =>
      Promise.reject(
        new ApiError(503, {
          code: 'LIDAR_UNAVAILABLE',
          message: 'unavailable',
          requestId: 'r1',
        }),
      );
    await renderPanel(fixtureIds.sculpture, clientWith(failing));

    expect(screen.getByRole('status')).toHaveTextContent(
      'momentanément indisponible',
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', STILL);
    expect(document.querySelector('model-viewer')).toBeNull();
  });

  it('renders nothing on error without a still image', async () => {
    const { container } = await renderPanel(
      fixtureIds.sculpture,
      clientWith(() => Promise.reject(new TypeError('offline'))),
      null,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
