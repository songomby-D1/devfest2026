/*
 * Demo content for the 3D room. Heritage paintings are rights-cleared
 * reproductions from Wikimedia Commons, with their attribution. Their files
 * live in the git-ignored public/media/ folder until D18 clears media for
 * the repository, so a missing file shows a missing-media state.
 *
 * The sculptures are procedural demonstration objects, not digitised
 * heritage, and are labelled as such everywhere they appear.
 */

export type ArtworkKind = 'painting' | 'sculpture';

export type RoomId = 'portraits' | 'objets';

export interface WikimediaCredit {
  readonly source: 'Wikimedia Commons';
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string | null;
  readonly page: string;
}

export interface DemoCredit {
  readonly source: 'LOVA';
  readonly note: string;
}

export interface ArtworkRecord {
  readonly id: string;
  readonly kind: ArtworkKind;
  readonly room: RoomId;
  readonly title: string;
  readonly artist: string;
  readonly date: string;
  readonly medium: string;
  readonly place: string;
  readonly description: string;
  /** Displayed size in metres: the canvas for a painting, the object for a sculpture. */
  readonly width: number;
  readonly height: number;
  /** Runtime path of the painting image, served from public/media/. */
  readonly image: string | null;
  readonly credit: WikimediaCredit | DemoCredit;
  /** True for generated or procedural demonstration content. */
  readonly demo: boolean;
}

export interface RoomRecord {
  readonly id: RoomId;
  readonly number: number;
  readonly label: string;
  readonly eyebrow: string;
  readonly title: readonly string[];
  readonly subtitle: string;
  readonly paragraphs: readonly string[];
}

const RAMANANKIRAHINA = 'Philippe-Auguste Ramanankirahina (1860–1915)';

function wikimedia(
  author: string,
  license: string,
  licenseUrl: string | null,
  page: string,
): WikimediaCredit {
  return { source: 'Wikimedia Commons', author, license, licenseUrl, page };
}

const PROCEDURAL: DemoCredit = {
  source: 'LOVA',
  note: 'Objet de démonstration modélisé en code, contenu fictif. Il sera remplacé par une numérisation 3D.',
};

export const rooms: readonly RoomRecord[] = [
  {
    id: 'portraits',
    number: 1,
    label: 'Peinture',
    eyebrow: 'Salle 01 · Peinture · Efitrano 01',
    title: ['Portraits', 'de la cour', 'd’Imerina'],
    subtitle: 'Souverains, lamba et lumière des Hautes Terres.',
    paragraphs: [
      'À la fin du XIXe siècle, le peintre malgache Philippe-Auguste Ramanankirahina réalise une série de portraits des souverains de l’Imerina, d’Andrianampoinimerina à Ranavalona II.',
      'Plusieurs de ces souverains étaient morts bien avant sa naissance : ces portraits sont des reconstructions qui fixent l’image de la monarchie merina.',
    ],
  },
  {
    id: 'objets',
    number: 2,
    label: 'Objets',
    eyebrow: 'Salle 02 · Objets · Efitrano 02',
    title: ['La terre', 'qui se', 'souvient'],
    subtitle: 'Jarres, pots et gestes des Hautes Terres.',
    paragraphs: [
      'La terre cuite accompagne la vie quotidienne : le sinibe garde l’eau fraîche, le vilany tany cuit le riz sur le foyer.',
      'Les objets présentés ici sont des modèles de démonstration. Les vitrines accueilleront ensuite les numérisations 3D des pièces réelles.',
    ],
  },
];

export const artworks: readonly ArtworkRecord[] = [
  {
    id: 'radama1',
    kind: 'painting',
    room: 'portraits',
    title: 'Radama Ier',
    artist: RAMANANKIRAHINA,
    date: 'Fin du XIXe siècle',
    medium: 'Portrait peint',
    place: 'Antananarivo',
    description:
      'Radama Ier régna sur l’Imerina de 1810 à 1828. Il ouvrit le royaume aux missionnaires britanniques, sous l’impulsion desquels le malgache fut transcrit en alphabet latin. Le peintre le représente en uniforme militaire à l’européenne, sabre à la main, devant un paysage de collines.',
    width: 0.77,
    height: 1.1,
    image: '/media/works/radama1.jpg',
    credit: wikimedia(
      RAMANANKIRAHINA,
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Radama_I,_portrait_by_Ramanankirahina.jpg',
    ),
    demo: false,
  },
  {
    id: 'andrianampoinimerina',
    kind: 'painting',
    room: 'portraits',
    title: 'Andrianampoinimerina',
    artist: RAMANANKIRAHINA,
    date: 'Fin du XIXe siècle',
    medium: 'Portrait peint',
    place: 'Antananarivo',
    description:
      'Roi de l’Imerina à la fin du XVIIIe siècle, Andrianampoinimerina unifia les Hautes Terres et fit d’Antananarivo sa capitale. Portrait posthume : le souverain est drapé dans un lamba blanc à bordure rayée.',
    width: 0.91,
    height: 1.1,
    image: '/media/works/andrianampoinimerina.jpg',
    credit: wikimedia(
      RAMANANKIRAHINA,
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Andrianampoinimerina_HQ.jpg',
    ),
    demo: false,
  },
  {
    id: 'sinibe',
    kind: 'sculpture',
    room: 'objets',
    title: 'Sinibe, jarre à eau des Hautes Terres',
    artist: 'Potier anonyme (modèle de démonstration)',
    date: 'Forme traditionnelle',
    medium: 'Terre cuite, modèle procédural',
    place: 'Hautes Terres centrales',
    description:
      'La grande jarre à eau garde l’eau fraîche près de la maison. Sa panse large et son col resserré limitent l’évaporation. Ce volume est généré en code, à l’échelle, pour préparer la vitrine qui accueillera une pièce numérisée.',
    width: 0.52,
    height: 0.62,
    image: null,
    credit: PROCEDURAL,
    demo: true,
  },
  {
    id: 'ranavalona1',
    kind: 'painting',
    room: 'portraits',
    title: 'Ranavalona Ire',
    artist: RAMANANKIRAHINA,
    date: 'Photographie du portrait, vers 1905',
    medium: 'Reproduction photographique ancienne d’un portrait peint',
    place: 'University of Southern California Libraries',
    description:
      'Ranavalona Ire régna de 1828 à 1861. Ce portrait nous est parvenu par une photographie ancienne conservée dans l’album de Chase Salmon Osborn, gouverneur du Michigan, qui visita Madagascar entre 1912 et 1913.',
    width: 0.72,
    height: 1.1,
    image: '/media/works/ranavalona1.jpg',
    credit: wikimedia(
      RAMANANKIRAHINA,
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Ranavalona_I_(USC).jpg',
    ),
    demo: false,
  },
  {
    id: 'radama2',
    kind: 'painting',
    room: 'portraits',
    title: 'Radama II',
    artist: 'Attribution incertaine, photographie de Robert Lisan',
    date: 'Photographie vers 1905',
    medium: 'Reproduction photographique d’un portrait peint',
    place: 'University of Southern California Libraries',
    description:
      'Radama II régna de 1861 à 1863, jusqu’à son assassinat. Selon la notice, l’original aurait été peint peu avant sa mort ; ce tableau pourrait aussi être une copie réalisée par Ramanankirahina.',
    width: 0.77,
    height: 1.1,
    image: '/media/works/radama2.jpg',
    credit: wikimedia(
      'Robert Lisan, d’après un portrait attribué à Ramanankirahina',
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Portrait_of_Radama_II,_by_Robert_Lisan.jpg',
    ),
    demo: false,
  },
  {
    id: 'vilany-tany',
    kind: 'sculpture',
    room: 'objets',
    title: 'Vilany tany, pot de cuisson',
    artist: 'Potier anonyme (modèle de démonstration)',
    date: 'Forme traditionnelle',
    medium: 'Terre cuite, modèle procédural',
    place: 'Hautes Terres centrales',
    description:
      'Le pot de cuisson en terre repose directement sur les pierres du foyer. Sa paroi épaisse répartit la chaleur du feu de bois. Objet de démonstration généré en code.',
    width: 0.4,
    height: 0.34,
    image: null,
    credit: PROCEDURAL,
    demo: true,
  },
  {
    id: 'ranavalona2',
    kind: 'painting',
    room: 'portraits',
    title: 'Ranavalona II',
    artist: RAMANANKIRAHINA,
    date: 'Photographie du portrait, vers 1905',
    medium: 'Reproduction photographique ancienne d’un portrait peint',
    place: 'University of Southern California Libraries',
    description:
      'Reine de Madagascar de 1868 à 1883, Ranavalona II se convertit au protestantisme en 1869. Couronnée, vêtue d’une cape d’apparat bordée de fourrure, elle pose dans un décor de studio.',
    width: 0.69,
    height: 1.1,
    image: '/media/works/ranavalona2.jpg',
    credit: wikimedia(
      RAMANANKIRAHINA,
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Ranavalona_II_(USC).jpg',
    ),
    demo: false,
  },
  {
    id: 'sikidy',
    kind: 'painting',
    room: 'portraits',
    title: 'Scène de divination par le sikidy, Tananarive',
    artist: 'Henri Ratova',
    date: '1912',
    medium: 'Peinture',
    place: 'Antananarivo',
    description:
      'Le sikidy est un art divinatoire malgache : le devin dispose des graines en colonnes sur une natte et lit les figures qu’elles forment. Ratova place la scène dans un intérieur aux murs de terre.',
    width: 1.24,
    height: 0.8,
    image: '/media/works/sikidy.jpg',
    credit: wikimedia(
      'Henri Ratova',
      'Domaine public',
      null,
      'https://commons.wikimedia.org/wiki/File:Sikidy,_Tananarive,_Painting.webp',
    ),
    demo: false,
  },
];

export function roomOf(work: ArtworkRecord): RoomRecord {
  const found = rooms.find((room) => room.id === work.room);
  if (found) {
    return found;
  }
  throw new Error(`Unknown room ${work.room} for work ${work.id}`);
}

export function formatIndex(
  index: number,
  total: number = artworks.length,
): string {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

export function formatSize(work: ArtworkRecord): string {
  const cm = (metres: number): string => String(Math.round(metres * 100));
  return `${cm(work.height)} × ${cm(work.width)} cm`;
}
