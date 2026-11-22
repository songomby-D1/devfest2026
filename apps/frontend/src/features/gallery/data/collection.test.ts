import { describe, expect, it } from 'vitest';
import type { ItemDetail } from '../../../lib/api';
import { fixtureIds, fixtureItems } from '../../../lib/api/fixtures';
import { buildRooms, toArtwork } from './collection';

function fixture(id: string): ItemDetail {
  const entry = fixtureItems.find((candidate) => candidate.item.id === id);
  if (entry === undefined) throw new Error(`missing fixture ${id}`);
  return entry.item;
}

describe('gallery mapping of API items', () => {
  it('hangs published items in the room of their kind, numbered in API order', () => {
    const rooms = buildRooms(fixtureItems.map((entry) => entry.item));
    const bySlug = Object.fromEntries(rooms.map((room) => [room.slug, room]));

    expect(
      bySlug['peinture']?.artworks.map((a) => [a.number, a.title]),
    ).toEqual([
      ['01', 'Femme malgache'],
      ['02', 'Antongona'],
      ['03', 'Pont d’Ambaniala'],
      ['04', 'Scène de divination par le sikidy, Tananarive'],
    ]);
    expect(bySlug['sculpture']?.artworks.map((a) => a.title)).toEqual([
      'Aloalo sculpté',
    ]);
    expect(bySlug['savoir-faire']?.artworks.map((a) => a.title)).toEqual([
      'Lamba mena',
    ]);
    expect(bySlug['musique']?.artworks).toEqual([]);
  });

  it('never hangs a draft or unpublished item, even if one is passed', () => {
    const rooms = buildRooms([
      fixture(fixtureIds.draft),
      fixture(fixtureIds.unpublished),
    ]);
    expect(rooms.every((room) => room.artworks.length === 0)).toBe(true);
  });

  it('maps the first image, the creator, the technique and both claim statuses', () => {
    const artwork = toArtwork(fixture(fixtureIds.antongona), 1);

    expect(artwork).toMatchObject({
      id: fixtureIds.antongona,
      number: '02',
      artist: 'Anonyme, monogramme « W.J. »',
      technique: 'Encre, aquarelle et gouache sur papier',
      year: '1875',
      claims: { item: 'verified', description: 'uncertain' },
    });
    expect(artwork.image.src).toBe(
      '/media/paintings/anonymous-antongona-1600.webp',
    );
    expect(artwork.alt).toContain('colline rocheuse');
    expect(artwork.story).toHaveLength(2);
    expect(artwork.details).toContainEqual([
      'Origine',
      'Imerina, Hautes Terres',
    ]);
  });

  it('falls back to the kind and an empty image when the item has neither', () => {
    const base = fixture(fixtureIds.textile);
    const artwork = toArtwork(
      {
        ...base,
        creator: { ...base.creator, technique: null },
        thumbnailUrl: null,
        media: [],
      },
      0,
    );

    expect(artwork.technique).toBe('Textile');
    expect(artwork.artist).toBe('Auteur non renseigné');
    expect(artwork.image.src).toBe('');
    expect(artwork.details.map(([label]) => label)).not.toContain('Période');
  });
});
