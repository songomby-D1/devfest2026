import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { settleMotion } from '../test/motion';
import { App } from './App';

const HOME_TITLE = 'L’art malagasy, à portée de regard.';

describe('App routing', () => {
  it('renders the home page at /', async () => {
    render(<App />);
    await settleMotion();

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: HOME_TITLE }),
    ).toBeTruthy();
  });

  it('renders the gallery room from a deep link', async () => {
    window.history.replaceState(null, '', '/musee/peinture/02');
    render(<App />);
    await settleMotion();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Les couleurs des Hautes Terres/,
      }),
    ).toBeTruthy();
    expect(screen.getByText('Œuvre 02 / 04')).toBeTruthy();
  });

  it('redirects /musee to the first artwork of the first room', () => {
    window.history.replaceState(null, '', '/musee');
    render(<App />);

    expect(window.location.pathname).toBe('/musee/peinture/01');
  });

  it('renders a not-found page for unknown paths', () => {
    window.history.replaceState(null, '', '/nulle-part');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Page introuvable',
    );
  });
});
