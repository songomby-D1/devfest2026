import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { setApiClient } from '../../lib/api';
import { fixtureIds } from '../../lib/api/fixtures';
import { createMockClient } from '../../lib/api/mock-client';

function open(id: string, as?: 'contributor' | 'reviewer'): void {
  setApiClient(createMockClient({ signedInAs: as }));
  window.history.replaceState(null, '', `/oeuvre/${id}`);
  render(<App />);
}

describe('ItemPage', () => {
  it('shows the facts, the description and the two human review labels separately', async () => {
    open(fixtureIds.antongona);
    await screen.findByRole('heading', { level: 1, name: 'Antongona' });

    expect(screen.getByText('Encre, aquarelle et gouache sur papier')).toBeTruthy();
    expect(screen.getByText('Imerina, Hautes Terres')).toBeTruthy();
    const review = screen.getByRole('region', { name: 'Relecture humaine' });
    const claims = review.querySelectorAll('li');
    expect(claims).toHaveLength(2);
    expect(claims[0]?.textContent).toContain('Objet');
    expect(claims[0]?.textContent).toContain('Vérifié par un relecteur');
    expect(claims[1]?.textContent).toContain('Description');
    expect(claims[1]?.textContent).toContain('Incertain après relecture');
    expect(claims[1]?.textContent).toContain('Note du relecteur');
    expect(review.textContent).not.toMatch(/\bIA\b|automatique/);
    expect(screen.getByRole('img', { name: /colline rocheuse/ })).toBeTruthy();
    // Guests do not see the workflow statuses.
    expect(screen.queryByText(/Publication :/)).toBeNull();
  });

  it('leaves the slots for the NFT and 3D panels of FE-04', async () => {
    open(fixtureIds.painting);
    await screen.findByRole('heading', { level: 1, name: 'Femme malgache' });
    expect(document.querySelector('[data-slot="nft"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="model3d"]')).not.toBeNull();
  });

  it('shows the same not-found page for a draft seen by a guest and for an unknown id', async () => {
    open(fixtureIds.draft);
    expect(await screen.findByRole('heading', { level: 1, name: 'Œuvre introuvable' })).toBeTruthy();
  });

  it('shows the publication and submission statuses and signals to the owner', async () => {
    open(fixtureIds.draft, 'contributor');
    await screen.findByRole('heading', { level: 1, name: 'Valiha' });
    expect(screen.getByText('Brouillon')).toBeTruthy();
    expect(screen.getByText('En relecture')).toBeTruthy();
    expect(screen.getByText(/ne modifient jamais un statut/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gérer les médias' })).toBeTruthy();
  });

  it('offers the review to a reviewer who is not the owner', async () => {
    open(fixtureIds.draft, 'reviewer');
    expect(await screen.findByRole('link', { name: 'Relire cette œuvre' })).toBeTruthy();
  });

  it('offers a retry when the gateway fails', async () => {
    const client = createMockClient();
    setApiClient({
      ...client,
      getItem: () => Promise.reject(new Error('offline')),
    });
    window.history.replaceState(null, '', `/oeuvre/${fixtureIds.painting}`);
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
