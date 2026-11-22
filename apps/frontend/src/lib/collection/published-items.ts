import { useEffect, useSyncExternalStore } from 'react';
import { api, ApiError } from '../api';
import type { ItemDetail, ItemSummary } from '../api';

/*
 * The published collection shown by the home and the gallery, read from
 * `GET /api/items` (public scope, every page) and then `GET /api/items/{id}`
 * for the wall label and notice. Loaded once per visit and shared by both
 * screens, so moving between rooms needs no new request.
 */

export type CollectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: readonly ItemDetail[] }
  | { status: 'error'; error: ApiError };

/** Upper bound on the pages read, so a large collection never stalls the visit. */
const MAX_PAGES = 4;
const PAGE_SIZE = 50;
const DETAIL_BATCH = 6;

type Listener = () => void;

let state: CollectionState = { status: 'idle' };
let generation = 0;
const listeners = new Set<Listener>();

function setState(next: CollectionState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function listAllPublished(): Promise<ItemSummary[]> {
  const summaries: ItemSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await api.listItems({
      scope: 'public',
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    });
    summaries.push(...result.items);
    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
  }
  return summaries;
}

/** Details in small batches. An item unpublished in between is skipped. */
async function loadDetails(
  summaries: readonly ItemSummary[],
): Promise<ItemDetail[]> {
  const details: ItemDetail[] = [];
  for (let start = 0; start < summaries.length; start += DETAIL_BATCH) {
    const batch = summaries.slice(start, start + DETAIL_BATCH);
    const results = await Promise.all(
      batch.map((summary) =>
        api.getItem(summary.id).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }),
      ),
    );
    details.push(
      ...results.filter((item): item is ItemDetail => item !== null),
    );
  }
  return details;
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, {
        code: 'UNKNOWN_ERROR',
        message: 'Le service est momentanément indisponible.',
        requestId: '',
      });
}

/** Loads, or reloads, the published collection. */
export async function loadCollection(): Promise<void> {
  generation += 1;
  const own = generation;
  setState({ status: 'loading' });
  try {
    const items = await loadDetails(await listAllPublished());
    if (own === generation) setState({ status: 'ready', items });
  } catch (error) {
    if (own === generation) setState({ status: 'error', error: toApiError(error) });
  }
}

/** Marks the collection stale, for example after a publication. */
export function invalidateCollection(): void {
  generation += 1;
  setState({ status: 'idle' });
}

/** For tests. */
export function resetCollection(): void {
  generation += 1;
  state = { status: 'idle' };
}

/** The published collection, loaded on first use. */
export function useCollection(): CollectionState {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    if (current.status === 'idle') void loadCollection();
  }, [current.status]);
  return current;
}
