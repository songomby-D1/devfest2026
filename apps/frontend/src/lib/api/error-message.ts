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
  IMAGE_INVALID: 'Image refusée : choisissez une photo JPEG, PNG ou WebP.',
  GENERATION_LIMIT_REACHED:
    'Deux générations sont déjà en cours. Attendez qu’elles se terminent.',
  GENERATION_REJECTED:
    'Le service de génération 3D a refusé cette image. Essayez une autre photo, sur fond simple.',
  GENERATION_CREDITS_EXHAUSTED:
    'Le quota de génération 3D est épuisé pour le moment.',
  GENERATION_BUSY:
    'Le service de génération 3D est saturé. Réessayez dans un instant.',
  GENERATION_UNAVAILABLE:
    'Le service de génération 3D est momentanément indisponible.',
  GENERATION_DISABLED: 'La génération 3D n’est pas activée sur ce serveur.',
  LIDAR_UNAVAILABLE: 'Le service 3D est momentanément indisponible.',
};

/**
 * Answers to what the visitor typed or did, not failures: support has nothing
 * to look up, so these never show a reference.
 */
const VISITOR_ANSWERS = new Set([
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_INVALID',
]);

export interface DisplayError {
  message: string;
  requestId: string;
  code: string;
  /**
   * True only for failures support can act on (server errors and unexpected
   * codes). A wrong password, a taken email or a refused file is the visitor's
   * own answer: no reference is shown for it.
   */
  showReference: boolean;
}

export function describeError(error: unknown): DisplayError {
  if (!(error instanceof ApiError)) {
    return {
      message: 'Une erreur inattendue est survenue.',
      requestId: '',
      code: 'UNKNOWN_ERROR',
      showReference: false,
    };
  }
  const message =
    error.code === 'FORBIDDEN'
      ? `Action refusée : ${error.message}`
      : (MESSAGES[error.code] ?? error.message);
  const expected = error.status < 500 && VISITOR_ANSWERS.has(error.code);
  return {
    message,
    requestId: error.requestId,
    code: error.code,
    showReference: error.requestId !== '' && !expected,
  };
}
