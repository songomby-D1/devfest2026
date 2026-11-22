import { ClaimStatuses } from '../../components/claim-statuses/ClaimStatuses';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import forms from '../../components/forms/forms.module.css';
import { ItemFacts } from '../../components/item-facts/ItemFacts';
import { ItemMedia } from '../../components/item-media/ItemMedia';
import { NotFoundPage } from '../../components/not-found/NotFoundPage';
import { PageShell } from '../../components/page-shell/PageShell';
import { StatusBadge } from '../../components/status-badge/StatusBadge';
import { api, ApiError } from '../../lib/api';
import type { AdvisorySignal, ItemDetail } from '../../lib/api';
import { useResource } from '../../lib/async/use-resource';
import {
  formatDate,
  PUBLICATION_LABEL,
  SUBMISSION_LABEL,
} from '../../lib/content/labels';
import { Link } from '../../lib/router/Link';
import { isReviewer, useSession } from '../../lib/session/session';
import styles from './ItemPage.module.css';

export interface ItemPageProps {
  id: string;
}

/** A 404, or a 400 for an id that is not a UUID, both read as "not found". */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

const SIGNAL_LABEL: Record<AdvisorySignal['kind'], string> = {
  ai_generated: 'Possible image générée par IA',
  description_mismatch: 'Possible écart entre l’image et la description',
};

function AdvisorySignals({ signals }: { signals: readonly AdvisorySignal[] }) {
  if (signals.length === 0) return null;
  return (
    <section className={styles.signals} aria-labelledby="signals-title">
      <h2 id="signals-title" className={styles.sectionTitle}>
        Signaux indicatifs
      </h2>
      <p className={forms.smallPrint}>
        Indices automatiques visibles du contributeur et des relecteurs
        seulement. Ils ne modifient jamais un statut de relecture.
      </p>
      <ul className={forms.list}>
        {signals.map((signal) => (
          <li key={`${signal.kind}-${signal.createdAt}`} className={styles.signal}>
            {SIGNAL_LABEL[signal.kind]} · score {signal.score.toFixed(2)}
            {signal.note !== null && <> · {signal.note}</>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemContent({ item }: { item: ItemDetail }) {
  const session = useSession();
  const reviewer = isReviewer(session);
  const showWorkflow = item.isOwner || reviewer;

  return (
    <article className={styles.layout}>
      <div className={styles.mediaColumn}>
        <ItemMedia media={item.media} title={item.title} />
        {/* TODO(#71): FE-04 mounts <Model3dPanel contentId={item.id} /> here. */}
        <section data-slot="model3d" aria-label="Modèle 3D" className={styles.slot} />
      </div>

      <div className={styles.textColumn}>
        <header className={styles.header}>
          <h1 className={styles.title}>{item.title}</h1>
          <p className={styles.byline}>
            {item.creator.name ?? item.creatorName ?? 'Auteur non renseigné'}
            {item.period !== null && <> · {item.period}</>}
          </p>
        </header>

        {showWorkflow && (
          <section aria-label="Suivi du dépôt" className={styles.workflow}>
            <div className={forms.badges}>
              <StatusBadge
                label="Publication"
                tone={item.publicationStatus === 'published' ? 'positive' : 'neutral'}
              >
                {PUBLICATION_LABEL[item.publicationStatus]}
              </StatusBadge>
              <StatusBadge
                label="Dépôt"
                tone={
                  item.submissionStatus === 'rejected'
                    ? 'negative'
                    : item.submissionStatus === 'returned'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {SUBMISSION_LABEL[item.submissionStatus]}
              </StatusBadge>
            </div>
            <div className={forms.actions}>
              {item.isOwner && item.publicationStatus !== 'published' && (
                <Link to={`/contribuer/${encodeURIComponent(item.id)}`} className={forms.secondary}>
                  Gérer les médias
                </Link>
              )}
              {reviewer && !item.isOwner && (
                <Link to={`/revue/${encodeURIComponent(item.id)}`} className={forms.secondary}>
                  Relire cette œuvre
                </Link>
              )}
            </div>
          </section>
        )}

        <ItemFacts item={item} />

        <section aria-labelledby="description-title" className={styles.description}>
          <h2 id="description-title" className={styles.sectionTitle}>
            Description
          </h2>
          {item.description
            .split(/\n\s*\n/)
            .filter((paragraph) => paragraph.trim() !== '')
            .map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
        </section>

        <ClaimStatuses claims={item.claims} reviews={item.reviews} />

        {showWorkflow && <AdvisorySignals signals={item.advisorySignals ?? []} />}

        <section aria-labelledby="rights-title">
          <h2 id="rights-title" className={styles.sectionTitle}>
            Droits
          </h2>
          <p className={styles.rights}>{item.rights.statement}</p>
          {item.publishedAt !== null && (
            <p className={forms.smallPrint}>Publiée le {formatDate(item.publishedAt)}.</p>
          )}
        </section>

        {/* TODO(#71): FE-04 mounts <NftPanel contentId={item.id} isOwner={item.isOwner} /> here. */}
        <section data-slot="nft" aria-label="Provenance numérique" className={styles.slot} />
      </div>
    </article>
  );
}

/** `/oeuvre/:id`: one item, for guests (published only), its owner and reviewers. */
export function ItemPage({ id }: ItemPageProps) {
  // The session decides what the item route returns: reload when it changes.
  const session = useSession();
  const viewer = session.status === 'signed-in' ? session.me.userId : 'guest';
  const { state, reload } = useResource(() => api.getItem(id), `${id}:${viewer}`);

  if (state.status === 'error' && isNotFound(state.error)) {
    return <NotFoundPage title="Œuvre introuvable" />;
  }

  return (
    <PageShell current="museum">
      {state.status === 'loading' && (
        <p className={forms.status} role="status">
          Chargement de l’œuvre…
        </p>
      )}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && <ItemContent item={state.data} />}
    </PageShell>
  );
}
