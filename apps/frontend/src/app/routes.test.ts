import { describe, expect, it } from 'vitest';
import { matchRoute } from './routes';

describe('matchRoute', () => {
  it('maps /visite to the WebGL room', () => {
    expect(matchRoute('/visite')).toEqual({ kind: 'visit' });
    expect(matchRoute('/visite/extra')).toEqual({ kind: 'not-found' });
  });

  it('maps the exhibitions and redirects their index to the first one', () => {
    expect(matchRoute('/expositions')).toEqual({
      kind: 'redirect',
      to: '/expositions/1',
    });
    expect(matchRoute('/expositions/1')).toEqual({
      kind: 'exhibition',
      id: '1',
    });
    expect(matchRoute('/expositions/1/billetterie')).toEqual({
      kind: 'tickets',
      id: '1',
    });
    expect(matchRoute('/expositions/1/extra')).toEqual({ kind: 'not-found' });
    expect(matchRoute('/expositions/1/billetterie/x')).toEqual({
      kind: 'not-found',
    });
    expect(matchRoute('/expositions/%E0%A4%A')).toEqual({ kind: 'not-found' });
  });

  it('maps the root to the home screen', () => {
    expect(matchRoute('/')).toEqual({ kind: 'home' });
  });

  it('maps the account, contribution and review pages', () => {
    expect(matchRoute('/connexion')).toEqual({ kind: 'sign-in' });
    expect(matchRoute('/inscription')).toEqual({ kind: 'register' });
    expect(matchRoute('/contribuer')).toEqual({ kind: 'contribute' });
    expect(matchRoute('/mes-depots')).toEqual({ kind: 'my-submissions' });
    expect(matchRoute('/revue')).toEqual({ kind: 'review-queue' });
  });

  it('maps the item pages with their decoded id', () => {
    expect(matchRoute('/oeuvre/abc-123')).toEqual({
      kind: 'item',
      id: 'abc-123',
    });
    expect(matchRoute('/contribuer/abc')).toEqual({
      kind: 'submission',
      id: 'abc',
    });
    expect(matchRoute('/revue/abc')).toEqual({ kind: 'review', id: 'abc' });
    expect(matchRoute('/oeuvre/a%20b')).toEqual({ kind: 'item', id: 'a b' });
    expect(matchRoute('/oeuvre/%E0%A4%A')).toEqual({ kind: 'not-found' });
    expect(matchRoute('/oeuvre/a/b')).toEqual({ kind: 'not-found' });
    expect(matchRoute('/oeuvre')).toEqual({ kind: 'not-found' });
  });

  it('redirects /musee to the first room', () => {
    expect(matchRoute('/musee')).toEqual({
      kind: 'redirect',
      to: '/musee/peinture',
    });
  });

  it('resolves a room and keeps the artwork number for the API data', () => {
    const route = matchRoute('/musee/peinture/03');
    expect(route.kind).toBe('gallery');
    if (route.kind === 'gallery') {
      expect(route.room.slug).toBe('peinture');
      expect(route.artworkNumber).toBe('03');
    }
    const bare = matchRoute('/musee/sculpture');
    expect(bare.kind === 'gallery' && bare.artworkNumber).toBeNull();
  });

  it('rejects unknown rooms, unknown pages and extra segments', () => {
    expect(matchRoute('/musee/cuisine')).toEqual({ kind: 'not-found' });
    expect(matchRoute('/musee/peinture/01/extra')).toEqual({
      kind: 'not-found',
    });
    expect(matchRoute('/toString')).toEqual({ kind: 'not-found' });
  });
});
