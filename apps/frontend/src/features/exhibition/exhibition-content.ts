/*
 * The first exhibition, cloned from the Haj'Aina "expositions/1" page
 * (3D viewer, narrated storyline, guest book) and rebuilt as a journey in
 * depth. Its objects are AI-generated illustrations (Meshy text-to-3D),
 * not digitised heritage, and every chapter says so.
 */

export interface Chapter {
  readonly id: string;
  /** Short label for the depth rail. */
  readonly label: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly material: string;
  /** Read aloud and typed by the narrator. */
  readonly narrative: string;
  readonly model: string;
  readonly poster: string | null;
  /** Height in metres the model is scaled to in the corridor. */
  readonly height: number;
  readonly credit: string;
  /** True for a model the visitor generated from a photo. */
  readonly generated: boolean;
}

export interface Tariff {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  /** In ariary; 0 is free. */
  readonly price: number;
}

/** The exhibition on site, for visitors who prefer the real thing. */
export interface Visit {
  readonly venue: string;
  readonly address: string;
  readonly city: string;
  /** Calendar days, `YYYY-MM-DD`, in Antananarivo time. */
  readonly opens: string;
  readonly closes: string;
  /** 0 is Sunday, as in Date#getUTCDay. */
  readonly closedWeekdays: readonly number[];
  readonly hours: string;
  /** Entry times, `HH:MM`. */
  readonly slots: readonly string[];
  readonly slotMinutes: number;
  readonly tariffs: readonly Tariff[];
  /** How the visitor pays at the desk. */
  readonly payment: string;
  /** Which tariffs need a document at the desk. */
  readonly proof: string;
  readonly maxTickets: number;
}

export interface Exhibition {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly subtitle: string;
  readonly curator: string;
  readonly chapters: readonly Chapter[];
  readonly visit: Visit;
}

const MODELS = '/models/exposition';

const AI_ILLUSTRATION =
  'Modèle généré par IA (Meshy, texte → 3D). Illustration, pas la numérisation d’un objet réel.';

export const exhibitions: readonly Exhibition[] = [
  {
    id: '1',
    number: '01',
    title: 'Héritage moderne',
    subtitle: 'Une traversée en profondeur',
    curator: 'Par Miora Rasoanaivo',
    chapters: [
      {
        id: 'prologue',
        label: 'Prologue',
        eyebrow: 'Prologue · Antananarivo',
        title: 'Héritage moderne',
        material: 'Création textile contemporaine',
        narrative:
          'Cette collection raconte l’histoire de l’héritage malgache modernisé. Avancez : chaque pas vous mène plus loin, plus près des mains qui ont façonné ces objets.',
        model: `${MODELS}/heritage-moderne.glb`,
        poster: null,
        height: 1.7,
        credit: 'Modèle de la collection Haj’Aina.',
        generated: false,
      },
      {
        id: 'aloalo',
        label: 'Aloalo',
        eyebrow: 'Chapitre I · Pays mahafaly',
        title: 'Aloalo',
        material: 'Bois sculpté',
        narrative:
          'Dans le Sud-Ouest, les aloalo se dressent sur les tombeaux. Leurs motifs empilés relient les vivants aux ancêtres, et le bois, taillé au couteau, porte la mémoire d’une lignée.',
        model: `${MODELS}/aloalo.glb`,
        poster: `${MODELS}/aloalo.webp`,
        height: 2.1,
        credit: AI_ILLUSTRATION,
        generated: false,
      },
      {
        id: 'lamba',
        label: 'Lamba',
        eyebrow: 'Chapitre II · Hautes Terres',
        title: 'Lamba',
        material: 'Soie sauvage tissée',
        narrative:
          'Le lamba se porte, se transmet et accompagne chaque passage de la vie. Les techniques traditionnelles du tissage de la soie sauvage rencontrent ici la vision contemporaine.',
        model: `${MODELS}/lamba.glb`,
        poster: `${MODELS}/lamba.webp`,
        height: 1.35,
        credit: AI_ILLUSTRATION,
        generated: false,
      },
      {
        id: 'sobika',
        label: 'Sobika',
        eyebrow: 'Chapitre III · Vannerie',
        title: 'Sobika',
        material: 'Raphia tressé',
        narrative:
          'Tressée à la main, la sobika porte le riz du marché jusqu’à la maison. Ses motifs, teints de couleurs végétales, évoquent les paysages de Madagascar.',
        model: `${MODELS}/sobika.glb`,
        poster: `${MODELS}/sobika.webp`,
        height: 0.95,
        credit: AI_ILLUSTRATION,
        generated: false,
      },
      {
        id: 'valiha',
        label: 'Valiha',
        eyebrow: 'Chapitre IV · Musique',
        title: 'Valiha',
        material: 'Bambou et cordes',
        narrative:
          'Instrument emblématique de l’île, la valiha est une cithare tubulaire taillée dans un bambou. Ses cordes accompagnent les chants, les fêtes et les cérémonies.',
        model: `${MODELS}/valiha.glb`,
        poster: `${MODELS}/valiha.webp`,
        height: 1.9,
        credit: AI_ILLUSTRATION,
        generated: false,
      },
      {
        id: 'omby',
        label: 'Omby',
        eyebrow: 'Épilogue · Le zébu',
        title: 'Omby',
        material: 'Bois sombre sculpté',
        narrative:
          'Le zébu est richesse, offrande et lien entre les familles. Il clôt la traversée : une invitation à découvrir la beauté d’un artisanat respectueux, et à prolonger l’exposition avec vos propres œuvres.',
        model: `${MODELS}/omby.glb`,
        poster: `${MODELS}/omby.webp`,
        height: 1.15,
        credit: AI_ILLUSTRATION,
        generated: false,
      },
    ],
    // Demo data: venue, dates and prices are not yet confirmed with the museum.
    visit: {
      venue: 'Musée d’Art et d’Archéologie',
      address: '17 rue du Docteur Villette, Isoraka',
      city: 'Antananarivo',
      opens: '2026-12-05',
      closes: '2027-02-27',
      closedWeekdays: [0, 1],
      hours: 'Du mardi au samedi, 9 h – 12 h et 14 h – 17 h',
      slots: ['09:00', '10:30', '14:00', '15:30'],
      slotMinutes: 90,
      tariffs: [
        {
          id: 'resident',
          label: 'Résident',
          detail: 'Nationaux et résidents à Madagascar',
          price: 5000,
        },
        {
          id: 'non-resident',
          label: 'Non-résident',
          detail: 'Visiteurs étrangers',
          price: 25000,
        },
        {
          id: 'etudiant',
          label: 'Étudiant',
          detail: 'Sur présentation de la carte',
          price: 2000,
        },
        {
          id: 'enfant',
          label: 'Enfant',
          detail: 'Moins de 12 ans, accompagné',
          price: 0,
        },
      ],
      payment: 'en espèces ou par Mobile Money',
      proof: 'Tarifs résident et étudiant sur justificatif à l’accueil.',
      maxTickets: 8,
    },
  },
];

export function findExhibition(id: string): Exhibition | undefined {
  return exhibitions.find((exhibition) => exhibition.id === id);
}

export const GENERATED_CREDIT =
  'Votre œuvre, modélisée par IA à partir de votre photo (Meshy, image → 3D).';
