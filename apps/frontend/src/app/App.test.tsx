import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtureIds } from '../lib/api/fixtures';
import { settleMotion } from '../test/motion';
import { App } from './App';

const HOME_TITLE = 'L’art malagasy, à portée de regard.';

describe('App routing', () => {
  it('renders the home page at /', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: HOME_TITLE });
    await settleMotion();

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the gallery room from a deep link once the items load', async () => {
    window.history.replaceState(null, '', '/musee/peinture/02');
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('Ouverture de la salle');

    await screen.findByRole('heading', {
      level: 1,
      name: /Les couleurs des Hautes Terres/,
    });
    await settleMotion();
    expect(screen.getByText('Œuvre 02 / 04')).toBeTruthy();
  });

  it('redirects /musee to the first artwork of the first room', async () => {
    window.history.replaceState(null, '', '/musee');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/musee/peinture/01');
    });
  });

  it('opens an item detail page from its id', async () => {
    window.history.replaceState(null, '', `/oeuvre/${fixtureIds.antongona}`);
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Antongona' }),
    ).toBeTruthy();
  });

  it('renders a not-found page for unknown paths', () => {
    window.history.replaceState(null, '', '/nulle-part');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Page introuvable',
    );
  });

  it('shows the contribution page with a sign-in path to a guest', async () => {
    window.history.replaceState(null, '', '/contribuer');
    render(<App />);

    const links = await screen.findAllByRole('link', { name: 'Se connecter' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/connexion?retour=%2Fcontribuer');
    }
  });
});
