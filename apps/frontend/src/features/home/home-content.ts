import { objectImages } from '../../lib/media/media';
import type { ImageSource } from '../../lib/media/media';
import { artworkPath, roomPath } from '../gallery/data/rooms';
import type { Room } from '../gallery/data/rooms';

export type HomeExhibitId =
  'women-in-lamba' | 'highlands-landscape' | 'vilany-tany' | 'sinibe';

/** One element of the home hanging. Figma layers "anim:frame" and "anim:object". */
export interface HomeExhibit {
  id: HomeExhibitId;
  kind: 'frame' | 'object';
  side: 'left' | 'right';
  title: string;
  region: string;
  image: ImageSource;
  alt: string;
  focalPoint?: string | undefined;
  roomName: string;
  to: string;
  /** Parallax depth from 0 to 1. Nearer objects move more. */
  depth: number;
}

type HomeExhibitDraft = Omit<HomeExhibit, 'image'> & {
  image: ImageSource | null;
};

/** The two frame slots of the Figma hanging, filled with the first published paintings. */
const FRAME_SLOTS = [
  { id: 'women-in-lamba', side: 'left', depth: 0.7 },
  { id: 'highlands-landscape', side: 'right', depth: 0.45 },
] as const;

/**
 * The home hanging: the first two published works of the painting room in the
 * two frames, and the objects once a rights-cleared photograph exists. A slot
 * without a work is left out, as an object without a photograph is.
 */
export function buildHomeExhibits(rooms: readonly Room[]): HomeExhibit[] {
  const painting = rooms.find((room) => room.slug === 'peinture');
  const crafts = rooms.find((room) => room.slug === 'savoir-faire');
  const drafts: HomeExhibitDraft[] = [];

  if (painting !== undefined) {
    const framed = painting.artworks.filter(
      (artwork) => artwork.image.src !== '',
    );
    FRAME_SLOTS.forEach((slot, index) => {
      const artwork = framed[index];
      if (artwork === undefined) return;
      drafts.push({
        ...slot,
        kind: 'frame',
        title: artwork.title,
        region: [artwork.artist, artwork.year]
          .filter((part) => part !== '')
          .join(', '),
        image: artwork.image,
        alt: artwork.alt,
        focalPoint: artwork.focalPoint,
        roomName: painting.name,
        to: artworkPath(painting, artwork),
      });
    });
  }

  if (crafts !== undefined) {
    drafts.push(
      {
        id: 'vilany-tany',
        kind: 'object',
        side: 'left',
        title: 'Vilany tany',
        region: 'Hautes Terres',
        image: objectImages.vilanyTany,
        alt: 'Vilany tany, pot de cuisson en terre cuite à large panse.',
        roomName: crafts.name,
        to: roomPath(crafts),
        depth: 1,
      },
      {
        id: 'sinibe',
        kind: 'object',
        side: 'right',
        title: 'Sinibe',
        region: 'Hautes Terres',
        image: objectImages.sinibe,
        alt: 'Sinibe, grande jarre à eau en terre cuite des Hautes Terres.',
        roomName: crafts.name,
        to: roomPath(crafts),
        depth: 0.85,
      },
    );
  }

  return drafts.filter((draft): draft is HomeExhibit => draft.image !== null);
}
