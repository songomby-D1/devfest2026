import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ambience } from '../../lib/audio/ambience';
import { SoundToggle } from './SoundToggle';

const track = { id: 'valiha', label: 'Valiha', src: '/media/audio/valiha.mp3' };

describe('SoundToggle', () => {
  it('starts off and labelled "Son coupé" with aria-pressed=false', () => {
    render(<SoundToggle theme="light" />);
    const button = screen.getByRole('button', { name: 'Son coupé' });

    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not start sound on mount or on track selection', () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    render(<SoundToggle theme="dark" />);
    ambience.setTrack(track);

    expect(play).not.toHaveBeenCalled();
  });

  it('enables sound on click and shows the track name in the dark theme', async () => {
    ambience.setTrack(track);
    render(<SoundToggle theme="dark" />);

    fireEvent.click(screen.getByRole('button', { name: 'Activer le son' }));
    await Promise.resolve();

    const button = screen.getByRole('button', { name: 'Valiha · en lecture' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles with the M key but not while typing', () => {
    render(
      <>
        <SoundToggle theme="light" />
        <input aria-label="recherche" />
      </>,
    );

    fireEvent.keyDown(window, { key: 'm' });
    expect(ambience.getState().enabled).toBe(true);

    fireEvent.keyDown(screen.getByLabelText('recherche'), { key: 'm' });
    expect(ambience.getState().enabled).toBe(true);
  });
});
