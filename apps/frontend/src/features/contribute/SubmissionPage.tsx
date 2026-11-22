import { ClaimStatuses } from '../../components/claim-statuses/ClaimStatuses';
import { ErrorNotice } from '../../components/error-notice/ErrorNotice';
import forms from '../../components/forms/forms.module.css';
import { ItemFacts } from '../../components/item-facts/ItemFacts';
import { ItemMedia } from '../../components/item-media/ItemMedia';
import { PageShell } from '../../components/page-shell/PageShell';
import { RequireUser } from '../../components/require-user/RequireUser';
import { StatusBadge } from '../../components/status-badge/StatusBadge';
import { api, ApiError } from '../../lib/api';
import type { ItemDetail } from '../../lib/api';
import { useResource } from '../../lib/async/use-resource';
import { PUBLICATION_LABEL, SUBMISSION_LABEL } from '../../lib/content/labels';
import { Link } from '../../lib/router/Link';
import { handleAuthError } from '../../lib/session/session';
import { MediaUpload } from './MediaUpload';

function Submission({ id }: { id: string }) {
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

  const item: ItemDetail = state.data;
  if (!item.isOwner) {
    return (
      <p className={forms.status} role="note">
        Seul le contributeur de cette œuvre peut gérer ses médias.{' '}
        <Link to={`/oeuvre/${encodeURIComponent(item.id)}`} className={forms.textLink}>
          Voir la fiche
        </Link>
      </p>
    );
  }
  const editable = item.publicationStatus !== 'published' && item.submissionStatus !== 'rejected';

  return (
    <>
      <header className={forms.form}>
        <h1 className={forms.title}>{item.title}</h1>
        <div className={forms.badges}>
          <StatusBadge label="Publication">{PUBLICATION_LABEL[item.publicationStatus]}</StatusBadge>
          <StatusBadge label="Dépôt">{SUBMISSION_LABEL[item.submissionStatus]}</StatusBadge>
        </div>
        <p className={forms.smallPrint}>
          Identifiant de l’œuvre : <code>{item.id}</code>
        </p>
        {item.media.length === 0 && (
          <p className={forms.success} role="status">
            Brouillon enregistré. Ajoutez au moins une photo ou une vidéo pour la relecture.
          </p>
        )}
      </header>

      {editable ? (
        <MediaUpload
          itemId={item.id}
          mediaCount={item.media.length}
          onUploaded={(media) => {
            setData({
              ...item,
              media: [...item.media, media],
              thumbnailUrl: item.thumbnailUrl ?? (media.kind === 'image' ? media.url : null),
            });
          }}
        />
      ) : (
        <p className={forms.status}>
          {item.submissionStatus === 'rejected'
            ? 'Ce dépôt a été refusé : ses médias ne peuvent plus changer.'
            : 'Cette œuvre est publiée : ses médias ne peuvent plus changer.'}
        </p>
      )}

      <section aria-label="Médias ajoutés">
        <ItemMedia media={item.media} title={item.title} />
      </section>

      <ClaimStatuses claims={item.claims} reviews={item.reviews} />
      <ItemFacts item={item} />

      <div className={forms.actions}>
        <Link to={`/oeuvre/${encodeURIComponent(item.id)}`} className={forms.secondary}>
          Voir la fiche de l’œuvre
        </Link>
        <Link to="/mes-depots" className={forms.textLink}>
          Tous mes dépôts
        </Link>
      </div>
    </>
  );
}

/** `/contribuer/:id`: the media step of a submission and its review status. */
export function SubmissionPage({ id }: { id: string }) {
  return (
    <PageShell current="mine" width="narrow">
      <RequireUser action="gérer ce dépôt">{() => <Submission id={id} />}</RequireUser>
    </PageShell>
  );
}
