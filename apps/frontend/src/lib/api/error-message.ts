import { ApiError, NETWORK_ERROR_CODE } from './client';

/**
 * French messages for the public error codes the screens expect. Any other
 * code shows the gateway's own safe `message`. Internal details never reach
 * the page: only `message` and the `requestId` for support.
 */
const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR_CODE]:
    'Connexion au serveur impossible. Vérifiez votre réseau.',
  UNAUTHENTICATED: 'Votre session a expiré. Connectez-vous à nouveau.',
  SESSION_INVALID: 'Votre session a expiré. Connectez-vous à nouveau.',
  INVALID_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
  EMAIL_ALREADY_REGISTERED: 'Un compte existe déjà avec cette adresse e-mail.',
  RATE_LIMITED: 'Trop de tentatives. Réessayez dans un instant.',
  AUTH_UNAVAILABLE:
    'Le service de comptes est indisponible. Les pages publiques restent consultables.',
  CONTENT_UNAVAILABLE: 'Le service des œuvres est momentanément indisponible.',
  FORBIDDEN_ORIGIN: 'Requête refusée : origine non autorisée.',
  PAYLOAD_TOO_LARGE: 'Fichier trop lourd pour le serveur.',
  UNSUPPORTED_MEDIA_TYPE:
    'Format refusé par le serveur : le contenu du fichier ne correspond pas à un format accepté.',
  MEDIA_LIMIT_REACHED: 'Nombre maximal de médias atteint pour cette œuvre.',
  NOT_FOUND: 'Cette œuvre est introuvable.',
  CLAIMS_UNREVIEWED:
    'Publication impossible : les affirmations sur l’objet et sur la description doivent toutes deux être relues.',
  RIGHTS_NOT_CONFIRMED:
    'Publication impossible : les droits n’ont pas été confirmés par le contributeur.',
  SUBMISSION_NOT_PUBLISHABLE:
    'Publication impossible : seul un dépôt en relecture ou accepté peut être publié.',
  SUBMISSION_NOT_IN_REVIEW: 'Ce dépôt n’est plus en relecture.',
  SUBMISSION_REJECTED: 'Ce dépôt a été refusé et ne peut plus être modifié.',
};

export interface DisplayError {
  message: string;
  requestId: string;
  code: string;
}

export function describeError(error: unknown): DisplayError {
  if (!(error instanceof ApiError)) {
    return {
      message: 'Une erreur inattendue est survenue.',
      requestId: '',
      code: 'UNKNOWN_ERROR',
    };
  }
  const message =
    error.code === 'FORBIDDEN'
      ? `Action refusée : ${error.message}`
      : (MESSAGES[error.code] ?? error.message);
  return { message, requestId: error.requestId, code: error.code };
}
