import { ClaimStatuses } from '../../components/claim-statuses/ClaimStatuses';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import forms from '../../components/forms/forms.module.css';
import { ItemFacts } from '../../components/item-facts/ItemFacts';
import { ItemMedia } from '../../components/item-media/ItemMedia';
import { PageShell } from '../../components/page-shell/PageShell';
import { RequireUser } from '../../components/require-user/RequireUser';
import { StatusBadge } from '../../components/status-badge/StatusBadge';
import { api, ApiError } from '../../lib/api';
import type { AdvisorySignal } from '../../lib/api';
import { useResource } from '../../lib/async/use-resource';
import { PUBLICATION_LABEL, SUBMISSION_LABEL } from '../../lib/content/labels';
import { Link } from '../../lib/router/Link';
import { handleAuthError } from '../../lib/session/session';
import { ClaimReviewForm } from './ClaimReviewForm';
import { DecisionForm } from './DecisionForm';
import styles from './ReviewItemPage.module.css';

const SIGNAL_LABEL: Record<AdvisorySignal['kind'], string> = {
  ai_generated: 'Possible image générée par IA',
  description_mismatch: 'Possible écart entre l’image et la description',
};

function ReviewItem({ id }: { id: string }) {
  const { state, reload, setData } = useResource(
    () =>
      api.getItem(id).catch((error: unknown) => {
        handleAuthError(error);
        throw error;
      }),
    id,
  );

  if (state.status === 'loading') {
    return (
      <p className={forms.status} role="status">
        Chargement du dépôt…
      </p>
    );
  }
  if (state.status === 'error') {
    if (state.error instanceof ApiError && (state.error.status === 404 || state.error.status === 400)) {
      return <p className={forms.status}>Ce dépôt est introuvable.</p>;
    }
    return <ErrorNotice error={state.error} onRetry={reload} />;
  }

  const item = state.data;
  const signals = item.advisorySignals ?? [];
  const closed = item.submissionStatus === 'rejected';

  return (
    <div className={styles.layout}>
      <div className={styles.column}>
        <header className={forms.form}>
          <h1 className={forms.title}>{item.title}</h1>
          <div className={forms.badges}>
            <StatusBadge label="Publication">{PUBLICATION_LABEL[item.publicationStatus]}</StatusBadge>
            <StatusBadge label="Dépôt">{SUBMISSION_LABEL[item.submissionStatus]}</StatusBadge>
            <StatusBadge label="Droits" tone={item.rights.confirmed ? 'positive' : 'negative'}>
              {item.rights.confirmed ? 'confirmés par le contributeur' : 'non confirmés'}
            </StatusBadge>
          </div>
        </header>
        <ItemMedia media={item.media} title={item.title} />
        <ItemFacts item={item} />
        <section aria-label="Description soumise">
          <h2 className={forms.legend}>Description soumise</h2>
          <p className={styles.text}>{item.description}</p>
        </section>
        <section aria-label="Déclaration de droits">
          <h2 className={forms.legend}>Déclaration de droits</h2>
          <p className={styles.text}>{item.rights.statement}</p>
        </section>
        {signals.length > 0 && (
          <section aria-label="Signaux indicatifs">
            <h2 className={forms.legend}>Signaux indicatifs</h2>
            <p className={forms.smallPrint}>
              Indices automatiques : ils aident la relecture mais ne fixent jamais un statut.
            </p>
            <ul className={forms.list}>
              {signals.map((signal) => (
                <li key={`${signal.kind}-${signal.createdAt}`} className={forms.smallPrint}>
                  {SIGNAL_LABEL[signal.kind]} · score {signal.score.toFixed(2)}
                  {signal.note !== null && <> · {signal.note}</>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className={styles.column}>
        <ClaimStatuses claims={item.claims} reviews={item.reviews} />
        {item.isOwner ? (
          <p className={forms.card} role="note">
            Vous avez déposé cette œuvre : un autre relecteur doit la relire.
          </p>
        ) : closed ? (
          <p className={forms.card} role="note">
            Ce dépôt a été refusé : il ne peut plus être relu ni publié.
          </p>
        ) : (
          <>
            <ClaimReviewForm item={item} target="item" onReviewed={setData} />
            <ClaimReviewForm item={item} target="description" onReviewed={setData} />
            <DecisionForm item={item} onDecided={setData} />
          </>
        )}
        <div className={forms.actions}>
          <Link to={`/oeuvre/${encodeURIComponent(item.id)}`} className={forms.textLink}>
            Voir la fiche de l’œuvre
          </Link>
          <Link to="/revue" className={forms.textLink}>
            Retour à la file de relecture
          </Link>
        </div>
      </div>
    </div>
  );
}

/** `/revue/:id`: separate item and description reviews, then the decision. */
export function ReviewItemPage({ id }: { id: string }) {
  return (
    <PageShell current="review">
      <RequireUser action="relire cette œuvre" reviewer>
        {() => <ReviewItem id={id} />}
      </RequireUser>
    </PageShell>
  );
}
