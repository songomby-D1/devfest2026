import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { setForcedReducedMotion } from '../../lib/motion/reduced-motion';
import { settleMotion } from '../../test/motion';

/** Renders the real app at a gallery URL, so the route drives the room and artwork. */
async function renderGalleryAt(path: string): Promise<void> {
  window.history.replaceState(null, '', path);
  render(<App />);
  // The items load from the (mock) gateway before the room opens.
  await screen.findByRole('navigation', { name: 'Salles' });
  await settleMotion();
}

describe('GalleryPage', () => {
  beforeEach(() => {
    // Reduced motion keeps swaps short. The full choreography is checked in the browser.
    setForcedReducedMotion(true);
  });

  afterEach(() => {
    setForcedReducedMotion(null);
  });

  it('shows the room, the counter and the wall label of the current artwork', async () => {
    await renderGalleryAt('/musee/peinture/01');

    expect(screen.getByText('Salle 01 sur 04 · Peinture')).toBeTruthy();
    expect(screen.getByText('Œuvre 01 / 04')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Femme malgache/ })).toBeTruthy();
  });

  it('navigates artworks with the arrow keys and updates the URL', async () => {
    await renderGalleryAt('/musee/peinture/01');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(window.location.pathname).toBe('/musee/peinture/02');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(window.location.pathname).toBe('/musee/peinture/01');
  });

  it('wraps around from the last artwork to the first', async () => {
    await renderGalleryAt('/musee/peinture/04');

    fireEvent.click(screen.getByRole('button', { name: 'Œuvre suivante' }));
    expect(window.location.pathname).toBe('/musee/peinture/01');
  });

  it('survives rapid repeated clicks and ends on the right artwork', async () => {
    await renderGalleryAt('/musee/peinture/01');
    const next = screen.getByRole('button', { name: 'Œuvre suivante' });

    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(next);
    }
    await settleMotion();

    // 7 steps from 01 in a room of 4 lands on 04, on the wall and in the URL.
    expect(window.location.pathname).toBe('/musee/peinture/04');
    expect(screen.getByText('Œuvre 04 / 04')).toBeTruthy();
  });

  it('opens the notice with the two human review statuses and a link to the item page', async () => {
    await renderGalleryAt('/musee/peinture/02');

    fireEvent.click(screen.getByRole('button', { name: /Lire la notice/ }));
    await settleMotion();

    const openDialog = screen
      .getAllByRole('dialog', { hidden: true })
      .find((element) => element.hasAttribute('open'));
    expect(openDialog).toBeTruthy();
    const review = screen.getByRole('region', { name: 'Relecture humaine' });
    expect(review.textContent).toContain('Objet');
    expect(review.textContent).toContain('Vérifié par un relecteur');
    expect(review.textContent).toContain('Description');
    expect(review.textContent).toContain('Incertain après relecture');
    expect(
      screen.getByRole('link', { name: /fiche complète/ }).getAttribute('href'),
    ).toMatch(/^\/oeuvre\//);
  });

  it('shows "Salle en préparation" and disables artwork controls in an empty room', async () => {
    await renderGalleryAt('/musee/musique');

    expect(screen.getByRole('status').textContent).toContain(
      'Salle en préparation',
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Œuvre suivante' })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /Observer de près/,
      }).disabled,
    ).toBe(true);
  });

  it('never starts audio on arrival', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    await renderGalleryAt('/musee/peinture/01');

    expect(play).not.toHaveBeenCalled();
  });
});
