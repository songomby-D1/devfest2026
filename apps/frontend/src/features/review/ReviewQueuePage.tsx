import forms from '../../components/forms/forms.module.css';
import { ScopedItemList } from '../../components/item-list/ScopedItemList';
import { PageShell } from '../../components/page-shell/PageShell';
import { RequireUser } from '../../components/require-user/RequireUser';

/** `/revue`: submissions in review, for reviewers. */
export function ReviewQueuePage() {
  return (
    <PageShell current="review">
      <h1 className={forms.title}>Relecture</h1>
      <p className={forms.lead}>
        Dépôts en attente de relecture. Relisez séparément l’objet et sa
        description, puis décidez de la publication.
      </p>
      <RequireUser action="relire des œuvres" reviewer>
        {() => (
          <ScopedItemList
            scope="review"
            linkOf={(item) => `/revue/${encodeURIComponent(item.id)}`}
            empty={
              <p className={forms.status}>
                Aucun dépôt en attente de relecture.
              </p>
            }
          />
        )}
      </RequireUser>
    </PageShell>
  );
}
