import { describe, expect, it } from 'vitest';
import { artworks } from './gallery-content';
import {
  CAMERA_FOV,
  ROOM,
  clamp,
  damp,
  focusPose,
  introPose,
  nearestIndex,
  placeArtworks,
  railBounds,
  roomLength,
  spotActivity,
  visitPose,
} from './gallery-layout';

describe('placeArtworks', () => {
  const placed = placeArtworks(artworks);

  it('spaces the works evenly along the wall, starting after the padding', () => {
    expect(placed[0]?.x).toBe(ROOM.padding);
    for (let i = 1; i < placed.length; i += 1) {
      expect((placed[i]?.x ?? 0) - (placed[i - 1]?.x ?? 0)).toBeCloseTo(
        ROOM.spacing,
      );
    }
  });

  it('hangs paintings on the wall and stands sculptures on their pedestal', () => {
    const painting = placed.find((work) => work.kind === 'painting');
    const sculpture = placed.find((work) => work.kind === 'sculpture');
    expect(painting?.z).toBe(ROOM.wallZ);
    expect(painting?.y).toBe(ROOM.hangHeight);
    expect(sculpture?.z).toBe(ROOM.sculptureZ);
    expect(sculpture?.y).toBeGreaterThan(ROOM.pedestalHeight);
  });

  it('bounds the rail between the first and the last work', () => {
    const bounds = railBounds(placed);
    expect(bounds.min).toBe(placed[0]?.x);
    expect(bounds.max).toBe(placed[placed.length - 1]?.x);
    expect(roomLength(placed)).toBeCloseTo(bounds.max + ROOM.padding);
  });

  it('handles an empty room', () => {
    expect(railBounds([])).toEqual({ min: 0, max: 0 });
    expect(nearestIndex([], 4)).toBe(0);
  });
});

describe('nearestIndex', () => {
  const placed = placeArtworks(artworks);

  it('returns the work closest to the visitor', () => {
    expect(nearestIndex(placed, ROOM.padding - 10)).toBe(0);
    expect(nearestIndex(placed, ROOM.padding + ROOM.spacing * 2 + 0.3)).toBe(2);
    expect(nearestIndex(placed, 1000)).toBe(placed.length - 1);
  });
});

describe('spotActivity', () => {
  it('is 1 in front of the work and fades continuously to 0', () => {
    expect(spotActivity(0)).toBe(1);
    expect(spotActivity(ROOM.spacing * 0.5)).toBeGreaterThan(0.2);
    expect(spotActivity(ROOM.spacing * 0.5)).toBeLessThan(0.9);
    expect(spotActivity(ROOM.spacing * 2)).toBe(0);
    expect(spotActivity(-1)).toBe(spotActivity(1));
  });

  it('never increases when the visitor walks away', () => {
    let previous = 1;
    for (let d = 0; d < 6; d += 0.1) {
      const value = spotActivity(d);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });
});

describe('camera poses', () => {
  const placed = placeArtworks(artworks);
  const painting = placed.find((work) => work.kind === 'painting');
  const sculpture = placed.find((work) => work.kind === 'sculpture');

  it('keeps the visitor on the rail, facing the wall', () => {
    const pose = visitPose(5);
    expect(pose.position).toEqual([5, ROOM.eyeHeight, ROOM.railZ]);
    expect(pose.target[2]).toBe(ROOM.wallZ);
  });

  it('brings the camera closer as zoom increases, without crossing the wall', () => {
    if (!painting) throw new Error('fixture needs a painting');
    const far = focusPose(painting, CAMERA_FOV, 16 / 9, 1);
    const near = focusPose(painting, CAMERA_FOV, 16 / 9, 2.4);
    expect(far.position[2]).toBeGreaterThan(near.position[2]);
    expect(near.position[2]).toBeGreaterThan(ROOM.wallZ);
    expect(far.target).toEqual([painting.x, painting.y, painting.z]);
  });

  it('looks at a sculpture from a three-quarter view', () => {
    if (!sculpture) throw new Error('fixture needs a sculpture');
    const pose = focusPose(sculpture, CAMERA_FOV, 16 / 9, 1);
    expect(pose.position[0]).toBeGreaterThan(sculpture.x);
    expect(pose.position[1]).toBeGreaterThan(sculpture.y);
    expect(pose.target).toEqual([sculpture.x, sculpture.y, sculpture.z]);
  });

  it('ends the intro travelling exactly on the rail', () => {
    const end = introPose(1, 7);
    expect(end.position).toEqual(visitPose(7).position);
    const start = introPose(0, 7);
    expect(start.position[2]).toBeGreaterThan(end.position[2]);
  });
});

describe('numeric helpers', () => {
  it('clamps and damps towards the target', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    const once = damp(0, 10, 4, 0.1);
    expect(once).toBeGreaterThan(0);
    expect(once).toBeLessThan(10);
    expect(damp(0, 10, 4, 10)).toBeCloseTo(10, 5);
  });
});
