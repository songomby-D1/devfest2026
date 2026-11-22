import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { validateRegistration } from './RegisterPage';

describe('account pages', () => {
  it('signs in and comes back to the protected page', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/connexion?retour=%2Fcontribuer');
    render(<App />);

    await user.type(screen.getByLabelText(/Adresse e-mail/), 'contributrice@lova.test');
    await user.type(screen.getByLabelText(/Mot de passe/), 'a-long-enough-phrase');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/contribuer');
    });
    expect(await screen.findByLabelText(/^Titre/)).toBeTruthy();
    // The header shows the account and a sign-out action.
    expect(screen.getByText('Contributrice de démonstration')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy();
  });

  it('shows one generic message and the request ID on wrong credentials', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/connexion');
    render(<App />);

    await user.type(screen.getByLabelText(/Adresse e-mail/), 'inconnu@lova.test');
    await user.type(screen.getByLabelText(/Mot de passe/), 'a-long-enough-phrase');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Adresse e-mail ou mot de passe incorrect.');
    expect(alert.textContent).toMatch(/Référence pour le support : mock-\d+/);
    expect(window.location.pathname).toBe('/connexion');
  });

  it('shows the reviewer capability and the review link for a reviewer', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/connexion?retour=%2Fmes-depots');
    render(<App />);

    await user.type(screen.getByLabelText(/Adresse e-mail/), 'relecteur@lova.test');
    await user.type(screen.getByLabelText(/Mot de passe/), 'a-long-enough-phrase');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Relecteur')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Relecture' }).getAttribute('href')).toBe('/revue');
  });

  it('registers, signs in at once and signs out', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/inscription?retour=%2Fmes-depots');
    render(<App />);

    await user.type(screen.getByLabelText(/Adresse e-mail/), 'nouvelle@lova.test');
    await user.type(screen.getByLabelText(/Nom affiché/), 'Nouvelle');
    await user.type(screen.getByLabelText(/^Mot de passe/), 'a-long-enough-phrase');
    await user.type(screen.getByLabelText(/Confirmer/), 'a-long-enough-phrase');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/mes-depots');
    });
    expect(await screen.findByText('Nouvelle')).toBeTruthy();
    expect(await screen.findByText('Aucun dépôt pour le moment.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    });
  });

  it('validates the registration form before calling the gateway', () => {
    expect(
      validateRegistration({
        email: 'pas-une-adresse',
        password: 'court',
        confirmation: 'autre',
        displayName: '',
      }),
    ).toEqual({
      email: 'Indiquez une adresse e-mail valide.',
      password: 'Le mot de passe compte de 12 à 128 caractères.',
      confirmation: 'Les deux mots de passe ne correspondent pas.',
    });
  });
});
