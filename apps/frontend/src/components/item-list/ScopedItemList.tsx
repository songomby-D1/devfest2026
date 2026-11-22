import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import type { ItemPage, ItemSummary } from '../../lib/api';
import { useResource } from '../../lib/async/use-resource';
import {
  CLAIM_STATUS_LABEL,
  KIND_LABEL,
  PUBLICATION_LABEL,
  SUBMISSION_LABEL,
} from '../../lib/content/labels';
import { Link } from '../../lib/router/Link';
import { handleAuthError } from '../../lib/session/session';
import { ErrorNotice } from '../error-notice/ErrorNotice';
import forms from '../forms/forms.module.css';
import { StatusBadge } from '../status-badge/StatusBadge';

export function SubmissionRow({ item, to }: { item: ItemSummary; to: string }) {
  return (
    <li className={forms.card}>
      <h2 className={forms.cardTitle}>
        <Link to={to} className={forms.textLink}>
          {item.title}
        </Link>
      </h2>
      <p className={forms.smallPrint}>
        {KIND_LABEL[item.kind]}
        {item.creatorName !== null && <> · {item.creatorName}</>}
      </p>
      <div className={forms.badges}>
        <StatusBadge label="Dépôt">
          {SUBMISSION_LABEL[item.submissionStatus]}
        </StatusBadge>
        <StatusBadge label="Publication">
          {PUBLICATION_LABEL[item.publicationStatus]}
        </StatusBadge>
        <StatusBadge label="Relecture de l’objet">
          {CLAIM_STATUS_LABEL[item.claims.item]}
        </StatusBadge>
        <StatusBadge label="Relecture de la description">
          {CLAIM_STATUS_LABEL[item.claims.description]}
        </StatusBadge>
      </div>
    </li>
  );
}

/** A paged list of one scope, with "load more" through the opaque cursor. */
export function ScopedItemList({
  scope,
  empty,
  linkOf,
}: {
  scope: 'mine' | 'review';
  empty: ReactNode;
  linkOf: (item: ItemSummary) => string;
}) {
  const { state, reload } = useResource<ItemPage>(
    () =>
      api.listItems({ scope }).catch((error: unknown) => {
        handleAuthError(error);
        throw error;
      }),
    scope,
  );
  const [more, setMore] = useState<{
    items: ItemSummary[];
    nextCursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);

  if (state.status === 'loading') {
    return (
      <p className={forms.status} role="status">
        Chargement…
      </p>
    );
  }
  if (state.status === 'error') {
    return <ErrorNotice error={state.error} onRetry={reload} />;
  }

  const items = [...state.data.items, ...(more?.items ?? [])];
  const nextCursor = more === null ? state.data.nextCursor : more.nextCursor;
  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <ul className={forms.list}>
        {items.map((item) => (
          <SubmissionRow key={item.id} item={item} to={linkOf(item)} />
        ))}
      </ul>
      {moreError !== null && <ErrorNotice error={moreError} />}
      {nextCursor !== null && (
        <div className={forms.actions}>
          <button
            type="button"
            className={forms.secondary}
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              setMoreError(null);
              api
                .listItems({ scope, cursor: nextCursor })
                .then((page) => {
                  setMore({
                    items: [...(more?.items ?? []), ...page.items],
                    nextCursor: page.nextCursor,
                  });
                })
                .catch((error: unknown) => {
                  setMoreError(error);
                })
                .finally(() => {
                  setLoadingMore(false);
                });
            }}
          >
            {loadingMore ? 'Chargement…' : 'Afficher plus'}
          </button>
        </div>
      )}
    </>
  );
}
