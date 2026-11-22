import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setApiClient } from '../../lib/api';
import { createMockClient } from '../../lib/api/mock-client';
import { setForcedReducedMotion } from '../../lib/motion/reduced-motion';
import { ExhibitionPage } from './ExhibitionPage';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

function currentChapter(): HTMLElement {
  return screen.getByRole('heading', { level: 2 });
}

function rail(): HTMLElement {
  return screen.getByRole('navigation', { name: /Chapitres/ });
}

describe('ExhibitionPage', () => {
  beforeEach(() => {
    setForcedReducedMotion(true);
    window.history.replaceState(null, '', '/expositions/1');
    window.localStorage.clear();
  });

  afterEach(() => {
    setForcedReducedMotion(null);
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  it('opens on the prologue with the exhibition title and the depth rail', () => {
    render(<ExhibitionPage id="1" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Héritage moderne' }),
    ).toBeInTheDocument();
    expect(currentChapter()).toHaveTextContent('Héritage moderne');
    const steps = within(rail()).getAllByRole('listitem');
    expect(steps).toHaveLength(6);
    expect(
      within(rail()).getByRole('button', { current: 'step' }),
    ).toHaveTextContent('Prologue');
  });

  it('moves deeper with the down arrow and back with the up arrow, not sideways', () => {
    render(<ExhibitionPage id="1" />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(currentChapter()).toHaveTextContent('Héritage moderne');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(currentChapter()).toHaveTextContent('Aloalo');
    expect(window.location.search).toBe('?chapitre=2');

    fireEvent.keyDown(window, { key: 'End' });
    expect(currentChapter()).toHaveTextContent('Omby');
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(currentChapter()).toHaveTextContent('Valiha');
  });

  it('advances one chapter for one wheel notch', () => {
    vi.useFakeTimers();
    try {
      render(<ExhibitionPage id="1" />);
      fireEvent.wheel(window, { deltaY: 100 });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(currentChapter()).toHaveTextContent('Aloalo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('travels to a chapter chosen on the rail, and opens from a deep link', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ExhibitionPage id="1" />);
    await user.click(within(rail()).getByRole('button', { name: /Sobika/ }));
    expect(currentChapter()).toHaveTextContent('Sobika');
    unmount();

    window.history.replaceState(null, '', '/expositions/1?chapitre=5');
    render(<ExhibitionPage id="1" />);
    expect(currentChapter()).toHaveTextContent('Valiha');
  });

  it('links to the ticket office from the header and the epilogue', () => {
    window.history.replaceState(null, '', '/expositions/1?chapitre=6');
    render(<ExhibitionPage id="1" />);
    expect(
      screen.getByRole('link', { name: /Billets pour l’exposition sur place/ }),
    ).toHaveAttribute('href', '/expositions/1/billetterie');
    expect(
      screen.getByRole('link', { name: /Voir l’exposition en vrai/ }),
    ).toHaveAttribute('href', '/expositions/1/billetterie');
  });

  it('labels the AI-generated illustrations', async () => {
    const user = userEvent.setup();
    render(<ExhibitionPage id="1" />);
    await user.click(within(rail()).getByRole('button', { name: /Lamba/ }));
    expect(screen.getByText(/Modèle généré par IA/)).toBeInTheDocument();
  });

  it('keeps guest-book notes on this device', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ExhibitionPage id="1" />);
    await user.click(screen.getByRole('button', { name: /Livre d’or/ }));
    const dialog = screen.getByRole('dialog', { name: 'Livre d’or' });
    await user.type(within(dialog).getByLabelText(/Votre mot/), 'Superbe');
    await user.clear(within(dialog).getByLabelText('Signature'));
    await user.type(within(dialog).getByLabelText('Signature'), 'Hery');
    await user.click(within(dialog).getByRole('button', { name: 'Signer' }));
    expect(within(dialog).getByText('Superbe')).toBeInTheDocument();
    unmount();

    render(<ExhibitionPage id="1" />);
    expect(
      screen.getByRole('button', { name: /Livre d’or/ }),
    ).toHaveTextContent('1');
  });

  it('asks a guest to sign in before generating', async () => {
    const user = userEvent.setup();
    render(<ExhibitionPage id="1" />);
    await user.click(screen.getByRole('button', { name: /Créer en 3D/ }));
    const dialog = screen.getByRole('dialog', {
      name: 'Créer une œuvre en 3D',
    });
    const link = await within(dialog).findByRole('link', {
      name: 'Se connecter',
    });
    expect(link).toHaveAttribute(
      'href',
      '/connexion?retour=%2Fexpositions%2F1',
    );
  });

  it('starts an image-to-3D generation for a signed-in visitor', async () => {
    setApiClient(createMockClient({ signedInAs: 'curator' }));
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 2000, height: 1500, close: () => undefined }),
    );
    const context = {
      fillRect: () => undefined,
      drawImage: () => undefined,
    };
    // getContext is overloaded; the 2D overload is the one the page uses.
    HTMLCanvasElement.prototype.getContext = (() =>
      context) as unknown as HTMLCanvasElement['getContext'];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,/9j/AAAA',
    );
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => undefined;

    const user = userEvent.setup();
    render(<ExhibitionPage id="1" />);
    await user.click(screen.getByRole('button', { name: /Créer en 3D/ }));
    const dialog = screen.getByRole('dialog', {
      name: 'Créer une œuvre en 3D',
    });
    const input = await within(dialog).findByLabelText(/Déposez une photo/);
    await user.upload(
      input,
      new File([new Uint8Array(64)], 'panier-tresse.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(within(dialog).getByLabelText('Titre de l’œuvre')).toHaveValue(
      'Panier tresse',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Générer en 3D' }),
    );
    expect(
      await within(dialog).findByRole('progressbar', {
        name: 'Génération de Panier tresse',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Génération \d+ %/ }),
    ).toBeInTheDocument();
  });

  it('refuses a file that is not a photo before any upload', async () => {
    setApiClient(createMockClient({ signedInAs: 'curator' }));
    const user = userEvent.setup({ applyAccept: false });
    render(<ExhibitionPage id="1" />);
    await user.click(screen.getByRole('button', { name: /Créer en 3D/ }));
    const dialog = screen.getByRole('dialog', {
      name: 'Créer une œuvre en 3D',
    });
    const input = await within(dialog).findByLabelText(/Déposez une photo/);
    await user.upload(
      input,
      new File(['GIF89a'], 'anim.gif', { type: 'image/gif' }),
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'JPEG, PNG ou WebP',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Générer en 3D' }),
    ).toBeDisabled();
  });

  it('shows the not-found page for an unknown exhibition', () => {
    render(<ExhibitionPage id="99" />);
    expect(screen.queryByRole('navigation', { name: /Chapitres/ })).toBeNull();
  });
});
