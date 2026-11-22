import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setForcedReducedMotion } from '../../lib/motion/reduced-motion';
import { settleMotion } from '../../test/motion';
import { setApiClient } from '../../lib/api';
import { ApiError } from '../../lib/api';
import { createMockClient } from '../../lib/api/mock-client';
import { HomePage } from './HomePage';
import { HomeRoute } from './HomeRoute';

/** Renders the home as the app does: the hanging comes from the published items. */
async function renderHome(): Promise<void> {
  render(<HomeRoute />);
  await waitFor(() => {
    expect(document.querySelector('[data-intro]')).not.toBeNull();
  });
  await settleMotion();
}

const HOME_TITLE = 'L’art malagasy, à portée de regard.';

describe('HomePage', () => {
  beforeEach(() => {
    setForcedReducedMotion(true);
  });

  afterEach(() => {
    setForcedReducedMotion(null);
  });

  it('hides content until its animation starts, then reveals it', async () => {
    const { container } = render(<HomePage exhibits={[]} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.visibility).toBe('hidden');
    await settleMotion();
    expect(root.style.visibility).not.toBe('hidden');
    expect(root.dataset['motion']).toBe('done');
  });

  it('keeps the headline a real h1 with the Figma copy', async () => {
    await renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: HOME_TITLE }),
    ).toBeTruthy();
  });

  it('renders the two CTAs as links to the museum and the contribution flow', async () => {
    await renderHome();

    // The hero and the closing section repeat them: every one keeps its target.
    const museum = screen.getAllByRole('link', {
      name: /Entrer dans le musée/,
    });
    const contribute = screen.getAllByRole('link', {
      name: /Déposer une œuvre/,
    });
    expect(museum.length).toBeGreaterThan(0);
    expect(contribute.length).toBeGreaterThan(0);
    for (const link of museum) expect(link.getAttribute('href')).toBe('/musee');
    for (const link of contribute) {
      expect(link.getAttribute('href')).toBe('/contribuer');
    }
  });

  it('hangs the two paintings as figures with alt text and a cartel, and skips objects without a photo', async () => {
    await renderHome();

    // Both pottery photos are pending (objectImages), so only the paintings hang.
    // The frieze below repeats the works, so the check stays on the hanging.
    const figures = screen.getAllByRole('figure');
    expect(figures).toHaveLength(2);
    const hung = (name: RegExp): boolean =>
      figures.some(
        (figure) => within(figure).queryByRole('img', { name }) !== null,
      );
    expect(hung(/femme malgache debout/i)).toBe(true);
    expect(hung(/colline rocheuse/i)).toBe(true);
    expect(
      figures.some((figure) => within(figure).queryByText('Antongona')),
    ).toBe(true);
    expect(screen.queryByText('Sinibe')).toBeNull();
  });

  it('links each frame to its artwork in the gallery', async () => {
    await renderHome();

    // The ribbon below links the same work to its notice: check the hanging.
    const frame = screen
      .getAllByRole('figure')
      .map((figure) =>
        within(figure).queryByRole('link', { name: /femme malgache debout/i }),
      )
      .find((link) => link !== null);
    expect(frame?.getAttribute('href')).toBe('/musee/peinture/01');
  });

  it('opens without frames when the collection cannot load', async () => {
    const client = createMockClient();
    setApiClient({
      ...client,
      listItems: () =>
        Promise.reject(
          new ApiError(503, {
            code: 'CONTENT_UNAVAILABLE',
            message: 'down',
            requestId: 'r-1',
          }),
        ),
    });
    await renderHome();

    expect(screen.queryAllByRole('figure')).toHaveLength(0);
    expect(
      screen.getByRole('heading', { level: 1, name: HOME_TITLE }),
    ).toBeTruthy();
  });

  it('never starts audio on mount', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    await renderHome();

    expect(play).not.toHaveBeenCalled();
  });
});
