import { useEffect, useSyncExternalStore } from 'react';
import { api, ApiError } from '../api';
import type { LoginRequest, Me, RegisterRequest } from '../api';

/*
 * The signed-in account, read from `GET /api/auth/me`. The session itself is
 * an HTTP-only cookie set by the gateway: nothing is stored in the browser.
 */

export type SessionState =
  | { status: 'unknown' }
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed-in'; me: Me };

type Listener = () => void;

let state: SessionState = { status: 'unknown' };
let pending: Promise<void> | null = null;
const listeners = new Set<Listener>();

function setState(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the current account once; a 401 means guest. Other failures also fall back to guest. */
export function refreshSession(): Promise<void> {
  pending ??= (async () => {
    if (state.status === 'unknown') setState({ status: 'loading' });
    try {
      setState({ status: 'signed-in', me: await api.me() });
    } catch {
      setState({ status: 'guest' });
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export async function signIn(request: LoginRequest): Promise<Me> {
  const me = await api.login(request);
  setState({ status: 'signed-in', me });
  return me;
}

/** Registers, then signs in with the same credentials. */
export async function register(request: RegisterRequest): Promise<Me> {
  await api.register(request);
  return signIn({ email: request.email, password: request.password });
}

export async function signOut(): Promise<void> {
  try {
    await api.logout();
  } finally {
    // The gateway clears the cookie even when Auth is down; forget the account anyway.
    setState({ status: 'guest' });
  }
}

/** Call when a protected request answers 401: the session expired or was revoked. */
export function handleAuthError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) {
    setState({ status: 'guest' });
  }
}

export function isReviewer(session: SessionState): boolean {
  return (
    session.status === 'signed-in' &&
    session.me.permissions.includes('reviewer')
  );
}

/** For tests: forget the account and any request in flight. */
export function resetSession(next: SessionState = { status: 'unknown' }): void {
  pending = null;
  state = next;
  for (const listener of listeners) listener();
}

/** The session, loaded on first use. */
export function useSession(): SessionState {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    if (state.status === 'unknown') void refreshSession();
  }, []);
  return current;
}

/** The sign-in page, coming back to `returnTo` afterwards. */
export function signInPath(returnTo: string): string {
  return `/connexion?retour=${encodeURIComponent(returnTo)}`;
}

/** Keeps only same-site paths, so a crafted link cannot send the user elsewhere. */
export function safeReturnPath(raw: string | null): string {
  if (raw === null || !/^\/(?![/\\])/.test(raw)) return '/';
  if (raw.startsWith('/connexion') || raw.startsWith('/inscription'))
    return '/';
  return raw;
}

export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}
