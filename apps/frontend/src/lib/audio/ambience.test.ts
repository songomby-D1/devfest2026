import { describe, expect, it, vi } from 'vitest';
import { ambience } from './ambience';

const track = { id: 'valiha', label: 'Valiha', src: '/media/audio/valiha.mp3' };

describe('ambience', () => {
  it('never plays until the visitor enables sound', () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');

    ambience.setTrack(track);

    expect(play).not.toHaveBeenCalled();
    expect(ambience.getState()).toMatchObject({
      enabled: false,
      status: 'off',
      track,
    });
  });

  it('plays the selected track once enabled and reports it', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    ambience.setTrack(track);

    ambience.enable();
    await Promise.resolve();

    expect(play).toHaveBeenCalledTimes(1);
    expect(ambience.getState().status).toBe('playing');
  });

  it('stops when disabled and ignores later track changes', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
    ambience.setTrack(track);
    ambience.enable();
    await Promise.resolve();

    ambience.disable();
    ambience.setTrack({
      id: 'other',
      label: 'Autre',
      src: '/media/audio/other.mp3',
    });

    expect(play).toHaveBeenCalledTimes(1);
    expect(ambience.getState()).toMatchObject({
      enabled: false,
      status: 'off',
    });
  });

  it('marks the track unavailable when playback is refused', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.reject(new Error('NotAllowedError')),
    );
    ambience.setTrack(track);

    ambience.enable();
    await Promise.resolve();
    await Promise.resolve();

    expect(ambience.getState().status).toBe('unavailable');
  });
});
