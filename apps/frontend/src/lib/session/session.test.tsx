import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setApiClient } from '../api';
import { createMockClient } from '../api/mock-client';
import {
  handleAuthError,
  refreshSession,
  safeReturnPath,
  signIn,
  signOut,
  useSession,
} from './session';
import { ApiError } from '../api';

function Probe() {
  const session = useSession();
  return (
    <p>
      {session.status}
      {session.status === 'signed-in' &&
        ` ${session.me.email} ${session.me.permissions.join(',')}`}
    </p>
  );
}

describe('session', () => {
  it('starts as a guest when /auth/me answers 401', async () => {
    render(<Probe />);
    expect(await screen.findByText('guest')).toBeTruthy();
  });

  it('reads the signed-in account and its reviewer permission from /auth/me', async () => {
    setApiClient(createMockClient({ signedInAs: 'reviewer' }));
    render(<Probe />);
    expect(
      await screen.findByText('signed-in relecteur@lova.test reviewer'),
    ).toBeTruthy();
  });

  it('signs in, then signs out', async () => {
    render(<Probe />);
    await screen.findByText('guest');

    await act(async () => {
      await signIn({
        email: 'contributrice@lova.test',
        password: 'a-long-enough-phrase',
      });
    });
    expect(screen.getByText(/signed-in contributrice@lova.test/)).toBeTruthy();

    await act(async () => {
      await signOut();
    });
    expect(screen.getByText('guest')).toBeTruthy();
  });

  it('keeps the guest state on wrong credentials', async () => {
    render(<Probe />);
    await screen.findByText('guest');
    await expect(
      signIn({ email: 'personne@lova.test', password: 'a-long-enough-phrase' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(screen.getByText('guest')).toBeTruthy();
  });

  it('falls back to guest when a protected call answers 401', async () => {
    setApiClient(createMockClient({ signedInAs: 'contributor' }));
    render(<Probe />);
    await screen.findByText(/signed-in/);

    act(() => {
      handleAuthError(
        new ApiError(401, {
          code: 'UNAUTHENTICATED',
          message: 'x',
          requestId: 'r',
        }),
      );
    });
    expect(screen.getByText('guest')).toBeTruthy();
    await act(async () => {
      await refreshSession();
    });
    await waitFor(() => {
      expect(screen.getByText(/signed-in/)).toBeTruthy();
    });
  });

  it('only returns to same-site paths after sign-in', () => {
    expect(safeReturnPath('/oeuvre/1?x=2')).toBe('/oeuvre/1?x=2');
    expect(safeReturnPath(null)).toBe('/');
    expect(safeReturnPath('https://evil.example')).toBe('/');
    expect(safeReturnPath('//evil.example')).toBe('/');
    expect(safeReturnPath('/\\evil.example')).toBe('/');
    expect(safeReturnPath('/connexion')).toBe('/');
  });
});
