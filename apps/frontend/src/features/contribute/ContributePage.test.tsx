import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { setApiClient } from '../../lib/api';
import { createMockClient } from '../../lib/api/mock-client';
import { checkMediaFile } from '../../lib/api/media-limits';
import { EMPTY_ITEM_FORM, toCreateRequest, validateItemForm } from './item-form';

const MIB = 1024 * 1024;

function signedInAt(path: string, as: 'contributor' | 'reviewer' = 'contributor'): void {
  setApiClient(createMockClient({ signedInAs: as, createId: (() => {
    let n = 0;
    return () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    };
  })() }));
  window.history.replaceState(null, '', path);
}

describe('contribution form validation', () => {
  it('requires the title, kind, description, rights statement and confirmation', () => {
    expect(validateItemForm(EMPTY_ITEM_FORM)).toEqual({
      title: 'Indiquez le titre de l’œuvre.',
      kind: 'Choisissez le type d’œuvre.',
      description: 'Décrivez l’œuvre.',
      rightsStatement: 'Indiquez les droits sur l’œuvre et ses médias.',
      rightsConfirmed:
        'Confirmez que vous détenez le droit de publier cette œuvre et ses médias.',
    });
  });

  it('enforces the contract lengths and sends blank optional fields as null', () => {
    const values = {
      ...EMPTY_ITEM_FORM,
      title: 'x'.repeat(161),
      kind: 'textile' as const,
      description: 'Une étoffe.',
      period: 'p'.repeat(81),
      rightsStatement: 'CC BY 4.0',
      rightsConfirmed: true,
    };
    expect(validateItemForm(values)).toEqual({
      title: '160 caractères au maximum.',
      period: '80 caractères au maximum.',
    });
    expect(toCreateRequest({ ...values, title: ' Lamba ', period: '  ' })).toMatchObject({
      title: 'Lamba',
      period: null,
      creatorName: null,
      rightsConfirmed: true,
    });
  });
});

describe('media upload hints', () => {
  it('accepts the Content formats within their size limits', () => {
    expect(checkMediaFile({ type: 'image/webp', size: 12 * MIB })).toEqual({ ok: true, kind: 'image' });
    expect(checkMediaFile({ type: 'video/mp4', size: 50 * MIB })).toEqual({ ok: true, kind: 'video' });
    expect(checkMediaFile({ type: 'image/png', size: 12 * MIB + 1 })).toMatchObject({ ok: false, reason: 'size' });
    expect(checkMediaFile({ type: 'image/gif', size: 10 })).toMatchObject({ ok: false, reason: 'type' });
    expect(checkMediaFile({ type: 'image/svg+xml', size: 10 })).toMatchObject({ ok: false, reason: 'type' });
    expect(checkMediaFile({ type: 'image/jpeg', size: 0 })).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('ContributePage', () => {
  it('announces each invalid field next to it and does not submit', async () => {
    const user = userEvent.setup();
    signedInAt('/contribuer');
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Enregistrer et ajouter/ }));

    const title = screen.getByLabelText(/^Titre/);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-describedby')).toContain('error');
    expect(screen.getByText('Indiquez le titre de l’œuvre.')).toBeTruthy();
    expect(screen.getByText(/Confirmez que vous détenez le droit/)).toBeTruthy();
    expect(window.location.pathname).toBe('/contribuer');
  });

  it('creates a draft, then uploads an image with progress and shows the statuses', async () => {
    // applyAccept off: the GIF must reach the client-side check, as a drag and drop would.
    const user = userEvent.setup({ applyAccept: false });
    signedInAt('/contribuer');
    render(<App />);

    await user.type(await screen.findByLabelText(/^Titre/), 'Lamba arindrano');
    await user.selectOptions(screen.getByLabelText(/Type d’œuvre/), 'textile');
    await user.type(screen.getByLabelText(/^Description/), 'Étoffe de soie.');
    await user.type(screen.getByLabelText(/Auteur ou autrice/), 'Rasoa');
    await user.type(screen.getByLabelText(/Déclaration de droits/), 'Photo de la contributrice, CC BY 4.0.');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Enregistrer et ajouter/ }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/contribuer/00000000-0000-4000-8000-000000000001');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Lamba arindrano' })).toBeTruthy();
    expect(screen.getByText(/Brouillon enregistré/)).toBeTruthy();
    expect(screen.getByText('Brouillon')).toBeTruthy();
    expect(screen.getByText('En relecture')).toBeTruthy();
    const review = screen.getByRole('region', { name: 'Relecture humaine' });
    expect(within(review).getAllByText('Pas encore relu')).toHaveLength(2);
    expect(screen.getByText(/JPEG, PNG ou WebP jusqu’à 12 Mo/)).toBeTruthy();

    const fileInput = screen.getByLabelText('Fichier');
    await user.upload(fileInput, new File(['gif'], 'anim.gif', { type: 'image/gif' }));
    expect(screen.getByText(/Format non accepté/)).toBeTruthy();

    await user.upload(fileInput, new File(['jpeg-bytes'], 'lamba.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText(/^Légende/), 'Lamba plié');
    await user.click(screen.getByRole('button', { name: 'Envoyer le fichier' }));

    expect(await screen.findByText('« lamba.jpg » a été ajouté.')).toBeTruthy();
    expect(screen.getByText(/1\s+déjà ajouté\)/)).toBeTruthy();
  });

  it('lists my submissions with their submission, publication and claim statuses', async () => {
    signedInAt('/mes-depots');
    render(<App />);

    const valiha = await screen.findByRole('link', { name: 'Valiha' });
    const card = valiha.closest('li');
    expect(card).not.toBeNull();
    const text = card?.textContent ?? '';
    expect(text).toContain('En relecture');
    expect(text).toContain('Brouillon');
    expect(text).toContain('Relecture de l’objet');
    expect(text).toContain('Relecture de la description');
    expect(screen.getByRole('link', { name: 'Sinibe' }).closest('li')?.textContent).toContain(
      'Renvoyée pour modification',
    );
    // Items of other accounts never show up.
    expect(screen.queryByRole('link', { name: 'Antongona' })).toBeNull();
  });
});
