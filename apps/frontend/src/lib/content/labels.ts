import type {
  ClaimStatus,
  ClaimTarget,
  ItemKind,
  PublicationStatus,
  SubmissionStatus,
} from '../api';

/** French interface labels of the contract enums. */

export const KIND_LABEL: Record<ItemKind, string> = {
  painting: 'Peinture',
  sculpture: 'Sculpture',
  photograph: 'Photographie',
  textile: 'Textile',
  object: 'Objet',
  other: 'Autre',
};

export const ITEM_KINDS = Object.keys(KIND_LABEL) as ItemKind[];

/** Who checked: a person. The labels never suggest an automated verification. */
export const CLAIM_TARGET_LABEL: Record<ClaimTarget, string> = {
  item: 'Objet',
  description: 'Description',
};

export const CLAIM_TARGET_HINT: Record<ClaimTarget, string> = {
  item: 'auteur, origine, période et technique de l’objet',
  description: 'texte descriptif de l’œuvre',
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  verified: 'Vérifié par un relecteur',
  uncertain: 'Incertain après relecture',
  unreviewed: 'Pas encore relu',
};

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  unpublished: 'Dépubliée',
};

export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  in_review: 'En relecture',
  returned: 'Renvoyée pour modification',
  rejected: 'Refusée',
  accepted: 'Acceptée',
};

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
}
