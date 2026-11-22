import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type ApiClient, type Provenance } from '../../lib/api';
import { clearMintKey, getOrCreateMintKey } from './mint-key';

/** First poll after 1 s, then doubling up to 15 s between polls. */
export const POLL_BASE_MS = 1_000;
export const POLL_MAX_MS = 15_000;
/** About ten minutes of polling before the panel asks for a manual refresh. */
export const POLL_MAX_ATTEMPTS = 45;

export function pollDelay(attempt: number): number {
  return Math.min(POLL_BASE_MS * 2 ** attempt, POLL_MAX_MS);
}

export type ProvenanceState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string; requestId: string }
  | { kind: 'ready'; provenance: Provenance };

export type MintFeedback =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  /** 202: a new pending mint. */
  | { kind: 'accepted' }
  /** 200: the same key was already accepted; nothing new was minted. */
  | { kind: 'replayed' }
  | {
      kind: 'error';
      reason: 'sign-in' | 'forbidden' | 'conflict' | 'not-found' | 'failed';
      message: string;
      requestId: string;
      /** The same key is reused on retry: the request may have reached the server. */
      retryable: boolean;
    };

const GENERIC_LOAD_ERROR = 'Le certificat n’a pas pu être chargé.';

const MINT_ERROR: Record<
  Exclude<Extract<MintFeedback, { kind: 'error' }>['reason'], 'failed'>,
  string
> = {
  'sign-in': 'Connectez-vous pour certifier cette œuvre.',
  forbidden:
    'Seul le ou la propriétaire de l’œuvre peut demander son certificat.',
  conflict: 'Cette œuvre a déjà un certificat ou une demande en cours.',
  'not-found': 'Seule une œuvre publiée peut être certifiée.',
};

function requestIdOf(error: unknown): string {
  return error instanceof ApiError ? error.requestId : '';
}

/**
 * Loads the provenance of an item, polls it with backoff while the mint is
 * pending (stopping on a final state or unmount), and starts a mint with the
 * idempotency key of the current intent.
 */
export function useProvenance(contentId: string, client: ApiClient) {
  const [state, setState] = useState<ProvenanceState>({ kind: 'loading' });
  const [feedback, setFeedback] = useState<MintFeedback>({ kind: 'idle' });
  const [stalled, setStalled] = useState(false);
  const [pollTrouble, setPollTrouble] = useState(false);
  const [loadToken, setLoadToken] = useState(0);
  // Increments on every new item or reload, so late answers are ignored.
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    setState({ kind: 'loading' });
    setStalled(false);
    client.getProvenance(contentId).then(
      (provenance) => {
        if (generation.current === current) {
          setState({ kind: 'ready', provenance });
        }
      },
      (error: unknown) => {
        if (generation.current !== current) return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: 'not-found' });
          return;
        }
        setState({
          kind: 'error',
          message:
            error instanceof ApiError ? error.message : GENERIC_LOAD_ERROR,
          requestId: requestIdOf(error),
        });
      },
    );
    return () => {
      generation.current += 1;
    };
  }, [client, contentId, loadToken]);

  useEffect(() => {
    setFeedback({ kind: 'idle' });
  }, [contentId]);

  const status = state.kind === 'ready' ? state.provenance.mint?.status : null;
  const pending = status === 'pending' && !stalled;

  // A final state ends the intent: the next attempt gets a new key.
  useEffect(() => {
    if (status === 'confirmed' || status === 'failed') clearMintKey(contentId);
  }, [contentId, status]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const tick = async () => {
      try {
        const provenance = await client.getProvenance(contentId);
        if (cancelled) return;
        setPollTrouble(false);
        setState({ kind: 'ready', provenance });
        if (provenance.mint?.status !== 'pending') return;
      } catch {
        if (cancelled) return;
        setPollTrouble(true);
      }
      attempt += 1;
      if (attempt >= POLL_MAX_ATTEMPTS) {
        setStalled(true);
        return;
      }
      timer = setTimeout(() => void tick(), pollDelay(attempt));
    };

    timer = setTimeout(() => void tick(), pollDelay(0));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, contentId, pending]);

  const reload = useCallback(() => {
    setPollTrouble(false);
    setLoadToken((token) => token + 1);
  }, []);

  const mint = useCallback(async () => {
    const current = generation.current;
    setFeedback({ kind: 'submitting' });
    const key = getOrCreateMintKey(contentId);
    try {
      const result = await client.mintItem(contentId, key);
      if (generation.current !== current) return;
      setFeedback({ kind: result.created ? 'accepted' : 'replayed' });
      setStalled(false);
      setState((previous) => ({
        kind: 'ready',
        provenance: {
          contentId,
          scope: previous.kind === 'ready' ? previous.provenance.scope : '',
          mint: result.mint,
        },
      }));
    } catch (error) {
      if (generation.current !== current) return;
      const requestId = requestIdOf(error);
      const status = error instanceof ApiError ? error.status : 0;
      const known = (
        reason: keyof typeof MINT_ERROR,
        retryable = false,
      ): MintFeedback => ({
        kind: 'error',
        reason,
        message: MINT_ERROR[reason],
        requestId,
        retryable,
      });
      switch (status) {
        case 401:
          // Kept: after signing in, the same intent continues with the same key.
          setFeedback(known('sign-in'));
          return;
        case 403:
          clearMintKey(contentId);
          setFeedback(known('forbidden'));
          return;
        case 404:
          clearMintKey(contentId);
          setFeedback(known('not-found'));
          return;
        case 409:
          // Another request owns the item: show it, and poll it if pending.
          clearMintKey(contentId);
          setFeedback(known('conflict'));
          reload();
          return;
        case 400:
        case 422:
          // The key was refused or belongs to another item: start a new intent.
          clearMintKey(contentId);
          setFeedback({
            kind: 'error',
            reason: 'failed',
            message:
              'La demande n’a pas pu être enregistrée. Vous pouvez réessayer.',
            requestId,
            retryable: true,
          });
          return;
        default:
          // Network error or 5xx: the request may have arrived, keep the key.
          setFeedback({
            kind: 'error',
            reason: 'failed',
            message:
              'La demande n’a pas abouti. Vous pouvez réessayer sans risque de doublon.',
            requestId,
            retryable: true,
          });
      }
    }
  }, [client, contentId, reload]);

  return { state, feedback, stalled, pollTrouble, mint, reload };
}
