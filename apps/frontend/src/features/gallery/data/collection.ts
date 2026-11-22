import type { ItemDetail, ItemKind } from '../../../lib/api';
import { KIND_LABEL } from '../../../lib/content/labels';
import type { ImageSource } from '../../../lib/media/media';
import type { Artwork, Room, RoomSlug } from './rooms';
import { rooms } from './rooms';

/**
 * Room of each item kind. Music has no item kind in the contract yet, so its
 * room stays "en préparation".
 */
export const ROOM_OF_KIND: Record<ItemKind, RoomSlug> = {
  painting: 'peinture',
  photograph: 'peinture',
  sculpture: 'sculpture',
  textile: 'savoir-faire',
  object: 'savoir-faire',
  other: 'savoir-faire',
};

/** Intrinsic size is unknown from the API; the frame crops with object-fit. */
const DEFAULT_SIZE = { width: 1200, height: 1500 };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The first image of the item: its thumbnail, else its first image media. */
export function imageOf(item: ItemDetail): { image: ImageSource; alt: string } {
  const media = item.media.find((entry) => entry.kind === 'image');
  const src = item.thumbnailUrl ?? media?.url ?? '';
  const creator = item.creator.name ?? item.creatorName;
  return {
    image: { src, srcSet: '', ...DEFAULT_SIZE },
    alt: media?.caption ?? (creator === null ? item.title : `${item.title}, ${creator}`),
  };
}

/** Maps a published item of the Content API onto the gallery's artwork view. */
export function toArtwork(item: ItemDetail, index: number): Artwork {
  const { image, alt } = imageOf(item);
  const artist = item.creator.name ?? item.creatorName ?? 'Auteur non renseigné';
  const technique = item.creator.technique ?? KIND_LABEL[item.kind];
  const details: [string, string | null][] = [
    ['Auteur', artist],
    ['Communauté', item.creator.community],
    ['Technique', technique],
    ['Période', item.period],
    ['Origine', item.origin],
  ];
  return {
    id: item.id,
    number: pad(index + 1),
    title: item.title,
    artist,
    year: item.period ?? '',
    technique,
    details: details.filter((entry): entry is [string, string] => entry[1] !== null),
    story: item.description
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== ''),
    rights: item.rights.statement,
    image,
    alt,
    claims: item.claims,
    reviews: item.reviews,
  };
}

/** The four rooms with the published items hung in them, in API order. */
export function buildRooms(items: readonly ItemDetail[]): Room[] {
  return rooms.map((room) => {
    const hung = items.filter(
      (item) =>
        item.publicationStatus === 'published' &&
        ROOM_OF_KIND[item.kind] === room.slug,
    );
    return { ...room, artworks: hung.map(toArtwork) };
  });
}
