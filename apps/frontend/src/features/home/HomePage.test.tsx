import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setForcedReducedMotion } from '../../lib/motion/reduced-motion';
import { settleMotion } from '../../test/motion';
import { HomePage } from './HomePage';

const HOME_TITLE = 'L’art malagasy, à portée de regard.';

describe('HomePage', () => {
  beforeEach(() => {
    setForcedReducedMotion(true);
  });

  afterEach(() => {
    setForcedReducedMotion(null);
  });

  it('hides content until its animation starts, then reveals it', async () => {
    const { container } = render(<HomePage />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.visibility).toBe('hidden');
    await settleMotion();
    expect(root.style.visibility).not.toBe('hidden');
    expect(root.dataset['motion']).toBe('done');
  });

  it('keeps the headline a real h1 with the Figma copy', async () => {
    render(<HomePage />);
    await settleMotion();

    expect(
      screen.getByRole('heading', { level: 1, name: HOME_TITLE }),
    ).toBeTruthy();
  });

  it('renders the two CTAs as links to the museum and the contribution flow', async () => {
    render(<HomePage />);
    await settleMotion();

    expect(
      screen
        .getByRole('link', { name: /Entrer dans le musée/ })
        .getAttribute('href'),
    ).toBe('/musee/peinture/01');
    expect(
      screen
        .getByRole('link', { name: /Déposer une œuvre/ })
        .getAttribute('href'),
    ).toBe('/contribuer');
  });

  it('hangs the two paintings as figures with alt text and a cartel, and skips objects without a photo', async () => {
    render(<HomePage />);
    await settleMotion();

    // Both pottery photos are pending (objectImages), so only the paintings hang.
    expect(screen.getAllByRole('figure')).toHaveLength(2);
    expect(
      screen.getByRole('img', { name: /femme malgache debout/i }),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: /colline rocheuse/i })).toBeTruthy();
    expect(screen.getByText('Antongona')).toBeTruthy();
    expect(screen.queryByText('Sinibe')).toBeNull();
  });

  it('never starts audio on mount', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    render(<HomePage />);
    await settleMotion();

    expect(play).not.toHaveBeenCalled();
  });
});
