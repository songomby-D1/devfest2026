import type { ImageSource } from '../../lib/media/media';
import { artworkImages, objectImages } from '../../lib/media/media';
import { artworkPath, findRoom, roomPath } from '../gallery/data/rooms';
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

function requireRoom(slug: string): Room {
  const room = findRoom(slug);
  if (room === undefined) {
    throw new Error(`Unknown room: ${slug}`);
  }
  return room;
}

const painting = requireRoom('peinture');
const crafts = requireRoom('savoir-faire');

function paintingPath(number: string): string {
  const artwork = painting.artworks.find(
    (candidate) => candidate.number === number,
  );
  return artwork === undefined
    ? roomPath(painting)
    : artworkPath(painting, artwork);
}

/*
 * The Figma frame slots were "Femmes au lamba" and "Allée des Baobabs". They
 * now hold real public-domain works: Shindler's "Malagasy Woman" on the left
 * and the 1875 "Antongona" watercolour on the right. Objects without a
 * rights-cleared photograph are left out until one exists.
 */
const drafts: readonly HomeExhibitDraft[] = [
  {
    id: 'women-in-lamba',
    kind: 'frame',
    side: 'left',
    title: 'Femme malgache',
    region: 'A. Z. Shindler, vers 1893',
    image: artworkImages.malagasyWoman,
    alt: 'Tableau : une femme malgache debout, drapée dans un lamba rayé, devant des maisons.',
    roomName: painting.name,
    to: paintingPath('01'),
    depth: 0.7,
  },
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
    id: 'highlands-landscape',
    kind: 'frame',
    side: 'right',
    title: 'Antongona',
    region: 'Imerina, 1875',
    image: artworkImages.antongona,
    alt: 'Aquarelle : une colline rocheuse de l’Imerina avec des maisons, de la terre rouge et des terrasses.',
    focalPoint: '50% 45%',
    roomName: painting.name,
    to: paintingPath('02'),
    depth: 0.45,
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
];

export const homeExhibits: readonly HomeExhibit[] = drafts.filter(
  (draft): draft is HomeExhibit => draft.image !== null,
);
