import type { AmbienceTrack } from '../audio/ambience';

/*
 * Every path to a cultural media file lives in this module, so files can be
 * replaced in one place. Sources and licenses are listed in
 * apps/frontend/media-sources.md.
 *
 * The files sit in public/media/, which Git ignores until D18 clears their
 * publication. When a file is absent, as in CI, components show a
 * missing-media state. Committed decor (scene, frame, spot, icons) is imported
 * from src/assets/ instead.
 */

export interface ImageSource {
  src: string;
  srcSet: string;
  /** Intrinsic size of the largest file, used for the aspect ratio. */
  width: number;
  height: number;
}

function webpSet(
  basePath: string,
  widths: readonly number[],
  size: { width: number; height: number },
): ImageSource {
  const largest = Math.max(...widths);
  return {
    src: `${basePath}-${String(largest)}.webp`,
    srcSet: widths
      .map((width) => `${basePath}-${String(width)}.webp ${String(width)}w`)
      .join(', '),
    width: size.width,
    height: size.height,
  };
}

const PAINTINGS = '/media/paintings';
const PAINTING_WIDTHS = [480, 960, 1600] as const;

/** Public-domain and CC0 paintings. See media-sources.md for each source. */
export const artworkImages = {
  malagasyWoman: webpSet(
    `${PAINTINGS}/shindler-malagasy-woman`,
    PAINTING_WIDTHS,
    {
      width: 1600,
      height: 2412,
    },
  ),
  antongona: webpSet(`${PAINTINGS}/anonymous-antongona`, PAINTING_WIDTHS, {
    width: 1600,
    height: 1100,
  }),
  bridgeAtAmbaniala: webpSet(
    `${PAINTINGS}/ellis-bridge-at-ambaniala`,
    PAINTING_WIDTHS,
    {
      width: 1600,
      height: 1004,
    },
  ),
  sikidy: webpSet(`${PAINTINGS}/ratovo-sikidy-tananarive`, PAINTING_WIDTHS, {
    width: 1600,
    height: 1036,
  }),
} satisfies Record<string, ImageSource>;

/**
 * Objects of the home hanging. No rights-cleared photograph on a plain
 * background exists yet, so both stay null and the home hides their figures.
 * Expected files: /media/objects/vilany-tany-{480,960}.webp and
 * /media/objects/sinibe-{480,960}.webp (FE-02 follow-up).
 */
export const objectImages: Record<'vilanyTany' | 'sinibe', ImageSource | null> =
  {
    vilanyTany: null,
    sinibe: null,
  };

/** Ambience tracks. Ogg Vorbis plays in Chrome and Firefox; Safari reports it unavailable. */
export const audioTracks = {
  valiha: {
    id: 'valiha',
    label: 'Valiha',
    src: '/media/audio/valiha-iny-hono-izy-ravorona.ogg',
  },
} satisfies Record<string, AmbienceTrack>;
