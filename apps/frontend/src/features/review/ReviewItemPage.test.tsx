import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { api, setApiClient } from '../../lib/api';
import { fixtureIds } from '../../lib/api/fixtures';
import { createMockClient } from '../../lib/api/mock-client';
import { validateClaimForm, validateDecision } from './review-form';

function openAs(
  path: string,
  as?: 'contributor' | 'reviewer',
): ReturnType<typeof userEvent.setup> {
  setApiClient(createMockClient({ signedInAs: as }));
  window.history.replaceState(null, '', path);
  render(<App />);
  return userEvent.setup();
}

function form(name: RegExp): HTMLElement {
  return screen.getByRole('form', { name });
}

describe('review form validation', () => {
  it('needs an outcome and a rationale; evidence is one source per line', () => {
    expect(
      validateClaimForm({ outcome: '', rationale: ' ', evidence: '' }),
    ).toEqual({
      outcome: 'Choisissez un résultat.',
      rationale:
        'Expliquez votre décision : la justification est enregistrée avec la relecture.',
    });
    expect(
      validateClaimForm({
        outcome: 'verified',
        rationale: 'ok',
        evidence: Array.from(
          { length: 21 },
          (_, i) => `source ${String(i)}`,
        ).join('\n'),
      }),
    ).toEqual({ evidence: '20 sources au maximum.' });
  });

  it('needs a note to return or reject, not to publish', () => {
    expect(validateDecision('publish', '')).toBeNull();
    expect(validateDecision('return', ' ')).toMatch(/note est obligatoire/);
    expect(validateDecision('reject', '')).toMatch(/note est obligatoire/);
    expect(validateDecision('', 'x')).toBe('Choisissez une décision.');
  });
});

describe('review screens', () => {
  it('lists the review queue for a reviewer only', async () => {
    openAs('/revue', 'reviewer');
    expect(await screen.findByRole('link', { name: 'Valiha' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Valiha' }).getAttribute('href'),
    ).toBe(`/revue/${fixtureIds.draft}`);
    // Returned and published items are not waiting for review.
    expect(screen.queryByRole('link', { name: 'Sinibe' })).toBeNull();
  });

  it('explains the page is for reviewers to a contributor', async () => {
    openAs('/revue', 'contributor');
    expect(await screen.findByText(/réservée aux relecteurs/)).toBeTruthy();
  });

  it('records item and description claims separately, then publishes', async () => {
    const user = openAs(`/revue/${fixtureIds.draft}`, 'reviewer');
    await screen.findByRole('heading', { level: 1, name: 'Valiha' });
    expect(
      screen.getByText(/Possible écart entre l’image et la description/),
    ).toBeTruthy();

    // Publishing first is refused by the service rule, surfaced with its request ID.
    const decision = form(/Décision sur le dépôt/);
    await user.click(within(decision).getByRole('radio', { name: /Publier/ }));
    await user.click(
      within(decision).getByRole('button', { name: 'Enregistrer la décision' }),
    );
    const refusal = await within(decision).findByRole('alert');
    expect(refusal.textContent).toContain('doivent toutes deux être relues');
    expect(refusal.textContent).toMatch(/mock-\d+/);

    const itemForm = form(/Affirmations sur : objet/);
    await user.click(within(itemForm).getByRole('radio', { name: 'Vérifié' }));
    await user.type(
      within(itemForm).getByLabelText(/Justification/),
      'Instrument conforme à la photo.',
    );
    await user.type(
      within(itemForm).getByLabelText(/Sources/),
      'Musée de la musique\nEntretien',
    );
    await user.click(
      within(itemForm).getByRole('button', {
        name: /Enregistrer la relecture/,
      }),
    );
    await within(itemForm).findByText('Relecture « Objet » enregistrée.');

    const claims = screen.getByRole('region', { name: 'Relecture humaine' });
    expect(claims.textContent).toContain('Vérifié par un relecteur');
    expect(claims.textContent).toContain('Pas encore relu');
    expect(claims.textContent).toContain(
      'Sources : Musée de la musique ; Entretien',
    );

    const descriptionForm = form(/Affirmations sur : description/);
    await user.click(
      within(descriptionForm).getByRole('radio', { name: 'Incertain' }),
    );
    await user.type(
      within(descriptionForm).getByLabelText(/Justification/),
      'Usage non confirmé.',
    );
    await user.click(
      within(descriptionForm).getByRole('button', {
        name: /Enregistrer la relecture/,
      }),
    );
    await within(descriptionForm).findByText(
      'Relecture « Description » enregistrée.',
    );
    expect(claims.textContent).toContain('Incertain après relecture');

    await user.click(within(decision).getByRole('radio', { name: /Publier/ }));
    await user.click(
      within(decision).getByRole('button', { name: 'Enregistrer la décision' }),
    );
    expect(
      await within(decision).findByText(/Publication : Publiée/),
    ).toBeTruthy();

    // The item is now public: a guest of the same gateway can open it.
    await api.logout();
    await expect(api.getItem(fixtureIds.draft)).resolves.toMatchObject({
      publicationStatus: 'published',
      submissionStatus: 'accepted',
    });
  });

  it('returns a submission with a mandatory note', async () => {
    const user = openAs(`/revue/${fixtureIds.draft}`, 'reviewer');
    await screen.findByRole('heading', { level: 1, name: 'Valiha' });
    const decision = form(/Décision sur le dépôt/);

    await user.click(within(decision).getByRole('radio', { name: /Renvoyer/ }));
    await user.click(
      within(decision).getByRole('button', { name: 'Enregistrer la décision' }),
    );
    expect(within(decision).getByText(/note est obligatoire/)).toBeTruthy();

    await user.type(
      within(decision).getByLabelText(/Note au contributeur/),
      'Ajoutez une photo de face.',
    );
    await user.click(
      within(decision).getByRole('button', { name: 'Enregistrer la décision' }),
    );
    expect(
      await within(decision).findByText(/dépôt : Renvoyée pour modification/),
    ).toBeTruthy();
  });

  it('hides the review actions on the reviewer’s own submission', async () => {
    openAs(`/revue/${fixtureIds.reviewerOwn}`, 'reviewer');
    expect(
      await screen.findByText(/un autre relecteur doit la relire/),
    ).toBeTruthy();
    expect(screen.queryByRole('form', { name: /Décision/ })).toBeNull();
  });

  it('surfaces a 403 self-review refusal from the service', async () => {
    const client = createMockClient({ signedInAs: 'reviewer' });
    await expect(
      client.reviewItem(fixtureIds.reviewerOwn, {
        target: 'item',
        outcome: 'verified',
        rationale: 'x',
        evidence: [],
      }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });

    // A reviewer whose page is stale still sees the refusal, with its reference.
    setApiClient({
      ...client,
      getItem: async (id) => ({
        ...(await client.getItem(id)),
        isOwner: false,
      }),
    });
    window.history.replaceState(null, '', `/revue/${fixtureIds.reviewerOwn}`);
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Lokanga' });
    const itemForm = form(/Affirmations sur : objet/);
    await user.click(within(itemForm).getByRole('radio', { name: 'Vérifié' }));
    await user.type(
      within(itemForm).getByLabelText(/Justification/),
      'Conforme.',
    );
    await user.click(
      within(itemForm).getByRole('button', {
        name: /Enregistrer la relecture/,
      }),
    );
    const alert = await within(itemForm).findByRole('alert');
    expect(alert.textContent).toContain('Action refusée');
    expect(alert.textContent).toMatch(/mock-\d+/);
  });
});
