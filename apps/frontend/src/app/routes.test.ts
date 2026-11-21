import { describe, expect, it } from 'vitest';
import { matchRoute } from './routes';

describe('matchRoute', () => {
  it('maps the root to the home screen', () => {
    expect(matchRoute('/')).toEqual({ kind: 'home' });
  });

  it('resolves an artwork URL to its room and index', () => {
    const route = matchRoute('/musee/peinture/03');
    expect(route.kind).toBe('gallery');
    if (route.kind === 'gallery') {
      expect(route.room.slug).toBe('peinture');
      expect(route.artworkIndex).toBe(2);
    }
  });

  it('redirects a bare room with artworks to its first artwork', () => {
    expect(matchRoute('/musee/peinture')).toEqual({
      kind: 'redirect',
      to: '/musee/peinture/01',
    });
  });

  it('shows a room without artworks as in preparation', () => {
    const route = matchRoute('/musee/sculpture');
    expect(route.kind).toBe('gallery');
    if (route.kind === 'gallery') {
      expect(route.artworkIndex).toBeNull();
    }
  });

  it('redirects an unknown artwork number back to the room', () => {
    expect(matchRoute('/musee/peinture/99')).toEqual({
      kind: 'redirect',
      to: '/musee/peinture/01',
    });
  });

  it('rejects unknown rooms and extra segments', () => {
    expect(matchRoute('/musee/cuisine')).toEqual({ kind: 'not-found' });
    expect(matchRoute('/musee/peinture/01/extra')).toEqual({
      kind: 'not-found',
    });
  });
});
