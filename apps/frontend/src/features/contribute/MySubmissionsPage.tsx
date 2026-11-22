import forms from '../../components/forms/forms.module.css';
import { ScopedItemList } from '../../components/item-list/ScopedItemList';
import { PageShell } from '../../components/page-shell/PageShell';
import { RequireUser } from '../../components/require-user/RequireUser';
import { Link } from '../../lib/router/Link';

/** `/mes-depots`: the signed-in contributor's items with their statuses. */
export function MySubmissionsPage() {
  return (
    <PageShell current="mine">
      <h1 className={forms.title}>Mes dépôts</h1>
      <p className={forms.lead}>
        Suivez la relecture et la publication de chaque œuvre déposée.
      </p>
      <RequireUser action="voir vos dépôts">
        {() => (
          <ScopedItemList
            scope="mine"
            linkOf={(item) => `/contribuer/${encodeURIComponent(item.id)}`}
            empty={
              <div className={forms.card}>
                <p className={forms.status}>Aucun dépôt pour le moment.</p>
                <div className={forms.actions}>
                  <Link to="/contribuer" className={forms.primary}>
                    Déposer une œuvre
                  </Link>
                </div>
              </div>
            }
          />
        )}
      </RequireUser>
    </PageShell>
  );
}
