import type { DecisionKind, ReviewOutcome } from '../../lib/api';

/** Lengths of the gateway's ReviewRequest and DecisionRequest. */
export const REVIEW_LIMITS = {
  rationale: 4000,
  evidenceItems: 20,
  evidenceText: 500,
  note: 4000,
} as const;

export interface ClaimFormValues {
  outcome: ReviewOutcome | '';
  rationale: string;
  /** One source per line. */
  evidence: string;
}

export interface ClaimFormErrors {
  outcome?: string;
  rationale?: string;
  evidence?: string;
}

export function evidenceList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export function validateClaimForm(values: ClaimFormValues): ClaimFormErrors {
  const errors: ClaimFormErrors = {};
  if (values.outcome === '') errors.outcome = 'Choisissez un résultat.';
  const rationale = values.rationale.trim();
  if (rationale === '') {
    errors.rationale = 'Expliquez votre décision : la justification est enregistrée avec la relecture.';
  } else if (rationale.length > REVIEW_LIMITS.rationale) {
    errors.rationale = `${String(REVIEW_LIMITS.rationale)} caractères au maximum.`;
  }
  const evidence = evidenceList(values.evidence);
  if (evidence.length > REVIEW_LIMITS.evidenceItems) {
    errors.evidence = `${String(REVIEW_LIMITS.evidenceItems)} sources au maximum.`;
  } else if (evidence.some((entry) => entry.length > REVIEW_LIMITS.evidenceText)) {
    errors.evidence = `Chaque source compte ${String(REVIEW_LIMITS.evidenceText)} caractères au maximum.`;
  }
  return errors;
}

export function validateDecision(decision: DecisionKind | '', note: string): string | null {
  if (decision === '') return 'Choisissez une décision.';
  if (decision !== 'publish' && note.trim() === '') {
    return 'Une note est obligatoire pour renvoyer ou refuser : elle explique au contributeur quoi corriger ou pourquoi.';
  }
  if (note.trim().length > REVIEW_LIMITS.note) {
    return `${String(REVIEW_LIMITS.note)} caractères au maximum.`;
  }
  return null;
}
