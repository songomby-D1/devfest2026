import type { ArtworkKind, ArtworkRecord } from './gallery-content';

/*
 * Pure scene geometry, in metres. The wall that carries the works is the
 * plane z = 0 and the visitor walks along the x axis in front of it.
 * Everything here is deterministic so the camera, the lights and the DOM
 * overlay agree on where each work is.
 */
export const ROOM = {
  wallZ: 0,
  depth: 7.5,
  height: 4.2,
  /** Free wall on each side of the first and last works. */
  padding: 3.2,
  /** Distance between two consecutive works. */
  spacing: 3.1,
  /** Height of the centre of a painting. */
  hangHeight: 1.62,
  eyeHeight: 1.58,
  /** Distance of the visitor rail from the wall. */
  railZ: 3.6,
  /** Pedestals stand in front of the wall. */
  sculptureZ: 1.35,
  pedestalHeight: 1,
  pedestalSize: 0.56,
} as const;

export const CAMERA_FOV = 42;

export const ZOOM_LEVELS: readonly number[] = [1, 1.6, 2.4];

export interface PlacedArtwork {
  readonly id: string;
  readonly index: number;
  readonly kind: ArtworkKind;
  /** Centre of the canvas, or of the object standing on its pedestal. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
}

export function placeArtworks(
  works: readonly ArtworkRecord[],
): PlacedArtwork[] {
  return works.map((work, index) => {
    const x = ROOM.padding + index * ROOM.spacing;
    if (work.kind === 'sculpture') {
      return {
        id: work.id,
        index,
        kind: work.kind,
        x,
        y: ROOM.pedestalHeight + work.height / 2,
        z: ROOM.sculptureZ,
        width: work.width,
        height: work.height,
      };
    }
    return {
      id: work.id,
      index,
      kind: work.kind,
      x,
      y: ROOM.hangHeight,
      z: ROOM.wallZ,
      width: work.width,
      height: work.height,
    };
  });
}

export interface RailBounds {
  readonly min: number;
  readonly max: number;
}

/** The rail stops in front of the first and the last work. */
export function railBounds(placed: readonly PlacedArtwork[]): RailBounds {
  const first = placed[0];
  const last = placed[placed.length - 1];
  if (first === undefined || last === undefined) {
    return { min: 0, max: 0 };
  }
  return { min: first.x, max: last.x };
}

/** Total length of the room along x. The room starts at x = 0. */
export function roomLength(placed: readonly PlacedArtwork[]): number {
  return railBounds(placed).max + ROOM.padding;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nearestIndex(
  placed: readonly PlacedArtwork[],
  x: number,
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const work of placed) {
    const distance = Math.abs(work.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = work.index;
    }
  }
  return best;
}

/**
 * How lit a work is, from 0 (far from the visitor) to 1 (in front of them).
 * A smoothstep keeps the transition continuous, so spots never flicker.
 */
export function spotActivity(
  distance: number,
  spacing: number = ROOM.spacing,
): number {
  const t = clamp(1 - Math.abs(distance) / (spacing * 1.15), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential smoothing. */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function easeOutCubic(t: number): number {
  const u = clamp(t, 0, 1);
  return 1 - (1 - u) ** 3;
}

export interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** Standing on the rail, looking straight at the wall. */
export function visitPose(railX: number): CameraPose {
  return {
    position: [railX, ROOM.eyeHeight, ROOM.railZ],
    target: [railX, ROOM.hangHeight - 0.08, ROOM.wallZ],
  };
}

/**
 * Close to a work. At zoom 1 the work fills about two thirds of the
 * viewport; higher zoom levels bring the camera proportionally closer.
 */
export function focusPose(
  placed: PlacedArtwork,
  fovDegrees: number,
  aspect: number,
  zoom: number,
): CameraPose {
  const fov = (fovDegrees * Math.PI) / 180;
  const fill = 0.68;
  const halfTan = Math.tan(fov / 2);
  const byHeight = placed.height / 2 / halfTan / fill;
  const byWidth = placed.width / 2 / (halfTan * Math.max(aspect, 0.5)) / fill;
  const distance = Math.max(byHeight, byWidth, 0.6) / Math.max(zoom, 1);
  if (placed.kind === 'sculpture') {
    const d = Math.max(distance, 1.15);
    return {
      position: [placed.x + d * 0.35, placed.y + 0.28, placed.z + d * 0.94],
      target: [placed.x, placed.y, placed.z],
    };
  }
  return {
    position: [placed.x, placed.y, placed.z + distance],
    target: [placed.x, placed.y, placed.z],
  };
}

/** The entrance travelling: from the back of the room down to the rail. */
export function introPose(progress: number, railX: number): CameraPose {
  const p = easeOutCubic(progress);
  const end = visitPose(railX);
  const startX = railX - 2.4;
  const startY = 2.1;
  const startZ = ROOM.depth - 0.2;
  return {
    position: [
      startX + (end.position[0] - startX) * p,
      startY + (end.position[1] - startY) * p,
      startZ + (end.position[2] - startZ) * p,
    ],
    target: [
      railX - 0.8 * (1 - p),
      end.target[1] + 0.25 * (1 - p),
      end.target[2],
    ],
  };
}
