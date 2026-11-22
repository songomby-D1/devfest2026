import type { ClaimReview, ClaimStatuses, ContentId } from '../../../lib/api';
import type { AmbienceTrack } from '../../../lib/audio/ambience';
import { audioTracks } from '../../../lib/media/media';
import type { ImageSource } from '../../../lib/media/media';

/*
 * Gallery structure. The rooms (titles, wall texts, ambience) are editorial
 * and stay here; their artworks come from the published items of the Content
 * API through the gateway, mapped onto rooms by `buildRooms` in collection.ts.
 * In mock mode the items are the fixtures of lib/api/fixtures.ts.
 */

export type RoomSlug = 'peinture' | 'sculpture' | 'savoir-faire' | 'musique';

/** Medium of the room, which selects the exhibit slot of the template. */
export type RoomMedium = 'painting' | 'sculpture' | 'craft' | 'music';

export interface Artwork {
  id: ContentId;
  /** Two-digit position in the room, also used in the URL: /musee/peinture/01. */
  number: string;
  title: string;
  artist: string;
  /** Period, as given by the contributor. */
  year: string;
  technique: string;
  /** Label and value pairs of the notice, only the known ones. */
  details: readonly (readonly [string, string])[];
  story: readonly string[];
  rights: string;
  image: ImageSource;
  alt: string;
  /** CSS object-position used when the frame opening crops the image. */
  focalPoint?: string | undefined;
  /** The two human review statuses, item and description. */
  claims: ClaimStatuses;
  reviews: readonly ClaimReview[];
}

export interface RoomAmbience {
  /** Wall finish used when no scene photograph exists for the room. */
  wallTone: 'red' | 'stone' | 'ochre' | 'indigo';
  /** Whether the room uses the committed red room photograph. */
  usesRedRoomScene: boolean;
  track: AmbienceTrack | null;
}

export interface Room {
  slug: RoomSlug;
  number: string;
  /** Short name used in tabs and the top bar. */
  name: string;
  /** Malagasy room label shown on the wall. */
  malagasyLabel: string;
  titleLines: readonly string[];
  subtitle: string;
  wallText: readonly string[];
  medium: RoomMedium;
  ambience: RoomAmbience;
  artworks: readonly Artwork[];
}

/** The rooms without their artworks: `buildRooms` fills them from the API. */
export const rooms: readonly Room[] = [
  {
    slug: 'peinture',
    number: '01',
    name: 'Peinture',
    malagasyLabel: 'Efitrano 01',
    titleLines: ['Les couleurs', 'des Hautes', 'Terres'],
    subtitle: 'Latérite, rizières et lumière de l’Imerina.',
    wallText: [
      'Les peintres des Hautes Terres reviennent sans cesse à la terre rouge, aux rizières en terrasses et aux maisons de briques à balcons de bois.',
      'Chaque œuvre de cette salle a été déposée par son auteur, avec son récit, sa technique et sa provenance.',
    ],
    medium: 'painting',
    ambience: {
      wallTone: 'red',
      usesRedRoomScene: false,
      track: audioTracks.valiha,
    },
    artworks: [],
  },
  {
    slug: 'sculpture',
    number: '02',
    name: 'Sculpture',
    malagasyLabel: 'Efitrano 02',
    titleLines: ['Mémoire', 'du bois'],
    subtitle: 'Aloalo, poteaux sculptés et figures du Sud.',
    wallText: [
      'Dans le Sud-Ouest, les Mahafaly dressent sur les tombeaux des aloalo, poteaux de bois sculptés qui racontent la vie des défunts.',
      'Cette salle présentera des sculptures numérisées en 3D, à faire tourner pour en découvrir chaque face.',
    ],
    medium: 'sculpture',
    ambience: {
      wallTone: 'stone',
      usesRedRoomScene: false,
      track: audioTracks.valiha,
    },
    artworks: [],
  },
  {
    slug: 'savoir-faire',
    number: '03',
    name: 'Savoir-faire',
    malagasyLabel: 'Efitrano 03',
    titleLines: ['Gestes', 'transmis'],
    subtitle: 'Tissage, vannerie et poterie, de main en main.',
    wallText: [
      'Lamba de soie, sobika tressées, poteries de terre : chaque objet porte un geste appris puis transmis.',
      'Les vidéos de cette salle suivront les artisans étape par étape.',
    ],
    medium: 'craft',
    ambience: {
      wallTone: 'ochre',
      usesRedRoomScene: false,
      track: audioTracks.valiha,
    },
    artworks: [],
  },
  {
    slug: 'musique',
    number: '04',
    name: 'Musique',
    malagasyLabel: 'Efitrano 04',
    titleLines: ['Le chant', 'du bambou'],
    subtitle: 'Valiha, marovany et chants des Hautes Terres.',
    wallText: [
      'La valiha, cithare tubulaire en bambou, est l’un des instruments emblématiques de Madagascar.',
      'Cette salle réunira des enregistrements à écouter comme dans une salle de concert.',
    ],
    medium: 'music',
    ambience: {
      wallTone: 'indigo',
      usesRedRoomScene: false,
      track: audioTracks.valiha,
    },
    artworks: [],
  },
];

export function findRoom(slug: string): Room | undefined {
  return rooms.find((room) => room.slug === slug);
}

export function roomPath(room: Room): string {
  const first = room.artworks[0];
  return first === undefined
    ? `/musee/${room.slug}`
    : `/musee/${room.slug}/${first.number}`;
}

export function artworkPath(room: Room, artwork: Artwork): string {
  return `/musee/${room.slug}/${artwork.number}`;
}
