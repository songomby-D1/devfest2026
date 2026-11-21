import type { PlacedArtwork } from './gallery-layout';

/*
 * Bridge between the frame loop and the DOM wall label. The 3D side projects
 * the label anchor every frame and moves the element directly, so the label
 * follows the camera without React renders or portals.
 */
export const labelAnchor: { element: HTMLElement | null } = { element: null };

/** World-space point beside a work where its wall label hangs. */
export function labelAnchorFor(
  work: PlacedArtwork,
): readonly [number, number, number] {
  if (work.kind === 'sculpture') {
    return [work.x - (work.width / 2 + 0.55), work.y - 0.1, work.z + 0.08];
  }
  return [
    work.x - (work.width / 2 + 0.62),
    work.y - work.height / 2 + 0.25,
    work.z + 0.08,
  ];
}
