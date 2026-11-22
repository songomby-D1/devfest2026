import type {
  MintStatus,
  MintVerification,
  VerificationState,
} from '../../lib/api';

// French interface copy of the certificate panel. The NFT service answers its
// `scope` and `failureReason` in English, so the panel shows its own French
// text and keeps only the public failure code from the service.

export const SCOPE_TEXT =
  'Ce certificat est un jeton (NFT) inscrit sur une blockchain publique de ' +
  'test. Il atteste que la galerie LOVA a enregistré cette œuvre publiée, ' +
  'avec l’empreinte de son image originale. Il ne prouve ni l’authenticité ' +
  'physique de l’œuvre, ni son auteur, ni la propriété de l’œuvre ou de ses droits.';

export const CUSTODY_TEXT =
  'Le jeton reste conservé par la galerie, dans son propre portefeuille : ' +
  'il n’est pas à vendre, ne vous est pas transféré et ne donne aucun droit sur l’œuvre.';

export const STATUS_TEXT: Record<MintStatus | 'none', string> = {
  none: 'Aucun certificat n’a encore été créé pour cette œuvre.',
  pending:
    'Certification en cours : la transaction attend sa confirmation sur la blockchain.',
  confirmed: 'Certificat confirmé sur la blockchain.',
  failed: 'La certification a échoué.',
};

const FAILURE_TEXT: Record<string, string> = {
  CONTRACT_REVERTED: 'Le contrat de certificat a refusé cette inscription.',
  INSUFFICIENT_FUNDS:
    'La galerie ne peut pas payer les frais du réseau pour le moment. Réessayez plus tard.',
  CHAIN_UNAVAILABLE: 'Le réseau blockchain est injoignable. Réessayez plus tard.',
  METADATA_UNAVAILABLE:
    'Les informations du certificat n’ont pas pu être publiées. Réessayez plus tard.',
  INVALID_METADATA: 'Cette œuvre ne peut pas être inscrite dans un certificat.',
  UNKNOWN: 'Le certificat n’a pas pu être créé. Réessayez plus tard.',
};

export function failureText(code: string | undefined): string {
  return FAILURE_TEXT[code ?? 'UNKNOWN'] ?? FAILURE_TEXT.UNKNOWN ?? '';
}

export const VERIFICATION_LABEL: Record<VerificationState, string> = {
  verified: 'Vérifié sur la blockchain',
  mismatch: 'Incohérence détectée',
  unverifiable: 'Vérification indisponible',
};

export function verificationText(verification: MintVerification): string {
  switch (verification.state) {
    case 'verified':
      return (
        'L’empreinte SHA-256 de l’image originale correspond à celle inscrite ' +
        'sur la blockchain, tout comme l’adresse des métadonnées du certificat.'
      );
    case 'mismatch':
      return verification.fixity === false
        ? 'L’empreinte inscrite sur la blockchain ne correspond pas à celle de ' +
            'l’image enregistrée par la galerie.'
        : 'Les métadonnées inscrites sur la blockchain diffèrent de celles ' +
            'enregistrées par la galerie.';
    case 'unverifiable':
      return (
        'La blockchain n’a pas pu être consultée. Les informations ci-dessous ' +
        'sont celles enregistrées par la galerie ; la vérification sera ' +
        'relancée au prochain affichage.'
      );
  }
}

/** `0x1234…abcd`: enough to recognise a hash or an address. */
export function shortHex(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/** Only http(s) links leave the page; anything else is shown as text. */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}
