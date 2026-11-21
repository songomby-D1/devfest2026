import { describe, expect, it } from 'vitest';
import { settleIndex } from './GalleryControls';
import { artworks } from './gallery-content';
import { ROOM, placeArtworks } from './gallery-layout';

describe('settleIndex', () => {
  const placed = placeArtworks(artworks);
  const xOf = (index: number): number => placed[index]?.x ?? 0;

  it('stays on the starting work for a tiny movement', () => {
    expect(settleIndex(placed, 2, xOf(2) + ROOM.spacing * 0.05)).toBe(2);
    expect(settleIndex(placed, 2, xOf(2) - ROOM.spacing * 0.05)).toBe(2);
  });

  it('advances one work per wheel notch, in the direction of travel', () => {
    expect(settleIndex(placed, 2, xOf(2) + ROOM.spacing * 0.15)).toBe(3);
    expect(settleIndex(placed, 2, xOf(2) - ROOM.spacing * 0.15)).toBe(1);
  });

  it('skips several works after a long swipe', () => {
    expect(settleIndex(placed, 0, xOf(0) + ROOM.spacing * 2.6)).toBe(3);
    expect(settleIndex(placed, 5, xOf(5) - ROOM.spacing * 1.4)).toBe(4);
  });

  it('never leaves the room', () => {
    expect(settleIndex(placed, 0, xOf(0) - 50)).toBe(0);
    expect(
      settleIndex(placed, placed.length - 1, xOf(placed.length - 1) + 50),
    ).toBe(placed.length - 1);
  });

  it('falls back to the nearest work for an unknown anchor', () => {
    expect(settleIndex(placed, 99, xOf(4) + 0.2)).toBe(4);
  });
});
