import { useId } from 'react';
import { api, type ApiClient } from '../../lib/api';
import { Link } from '../../lib/router/Link';
import styles from './NftPanel.module.css';
import { ProvenanceDetails } from './ProvenanceDetails';
import {
  CUSTODY_TEXT,
  failureText,
  SCOPE_TEXT,
  STATUS_TEXT,
} from './provenance-copy';
import { useProvenance } from './use-provenance';

export interface NftPanelProps {
  contentId: string;
  /** From `ItemDetail.isOwner`: only the owner sees the certify action. */
  isOwner: boolean;
  /** Sign-in path for a 401; the current path is appended as `retour`. */
  signInPath?: string;
  client?: ApiClient;
}

function signInHref(signInPath: string): string {
  const back = `${window.location.pathname}${window.location.search}`;
  return `${signInPath}?retour=${encodeURIComponent(back)}`;
}

/**
 * Digital certificate (NFT) of a published item: its status for everyone and,
 * for the owner, the action that requests it. The certificate is custodial:
 * the gallery wallet keeps the token, nothing is sold or transferred.
 */
export function NftPanel({
  contentId,
  isOwner,
  signInPath = '/connexion',
  client = api,
}: NftPanelProps) {
  const headingId = useId();
  const { state, feedback, stalled, pollTrouble, mint, reload } = useProvenance(
    contentId,
    client,
  );

  if (state.kind === 'not-found') {
    // Unknown, draft and unpublished items answer the same 404.
    return isOwner ? (
      <section className={styles.panel} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.heading}>
          Certificat numérique
        </h2>
        <p className={styles.muted}>
          La certification sera possible une fois l’œuvre publiée.
        </p>
      </section>
    ) : null;
  }

  const provenance = state.kind === 'ready' ? state.provenance : null;
  const current = provenance?.mint ?? null;
  const status = current?.status ?? 'none';
  const submitting = feedback.kind === 'submitting';
  const pending = status === 'pending';
  const canRequest =
    isOwner &&
    state.kind === 'ready' &&
    (status === 'none' || status === 'failed');

  let statusLine = '';
  if (state.kind === 'loading') statusLine = 'Chargement du certificat…';
  else if (state.kind === 'ready') statusLine = STATUS_TEXT[status];

  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      aria-busy={state.kind === 'loading' || pending}
      data-status={state.kind === 'ready' ? status : state.kind}
    >
      <h2 id={headingId} className={styles.heading}>
        Certificat numérique
      </h2>
      <p className={styles.scope}>{SCOPE_TEXT}</p>
      <p className={styles.custody}>{CUSTODY_TEXT}</p>

      <div role="status" aria-live="polite" className={styles.status}>
        {pending && <span className={styles.spinner} aria-hidden="true" />}
        <span>{statusLine}</span>
        {status === 'failed' && current && (
          <span className={styles.failure}>
            {' '}
            {failureText(current.failureCode)}{' '}
            <span className={styles.muted}>
              (code {current.failureCode ?? 'UNKNOWN'})
            </span>
          </span>
        )}
        {feedback.kind === 'replayed' && pending && (
          <span> Votre demande était déjà enregistrée.</span>
        )}
      </div>

      {pending && stalled && (
        <p className={styles.muted}>
          La confirmation prend plus de temps que prévu.{' '}
          <button type="button" className={styles.linkButton} onClick={reload}>
            Actualiser
          </button>
        </p>
      )}
      {pending && pollTrouble && !stalled && (
        <p className={styles.muted}>
          Connexion interrompue, nouvelle tentative automatique…
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className={styles.alert}>
          <p>Le certificat n’a pas pu être chargé.</p>
          {state.requestId && (
            <p className={styles.muted}>Référence : {state.requestId}</p>
          )}
          <button type="button" className={styles.button} onClick={reload}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'confirmed' && current && (
        <ProvenanceDetails mint={current} />
      )}

      {isOwner && (canRequest || pending || submitting) && (
        <div className={styles.action}>
          <button
            type="button"
            className={styles.button}
            disabled={!canRequest || submitting}
            aria-disabled={!canRequest || submitting}
            onClick={() => void mint()}
          >
            {submitting
              ? 'Envoi de la demande…'
              : pending
                ? 'Certification en cours…'
                : status === 'failed'
                  ? 'Relancer la certification'
                  : 'Certifier sur la blockchain'}
          </button>
          <p className={styles.muted}>
            Inscrit l’empreinte de l’image originale sur la blockchain, sans
            frais pour vous. Aucune donnée personnelle n’est publiée.
          </p>
        </div>
      )}

      {feedback.kind === 'error' && (
        <div role="alert" className={styles.alert}>
          <p>{feedback.message}</p>
          {feedback.reason === 'sign-in' && (
            <Link className={styles.link} to={signInHref(signInPath)}>
              Se connecter
            </Link>
          )}
          {feedback.requestId && (
            <p className={styles.muted}>Référence : {feedback.requestId}</p>
          )}
        </div>
      )}
    </section>
  );
}
