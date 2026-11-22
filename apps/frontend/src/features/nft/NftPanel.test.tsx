import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient, type MintResult } from '../../lib/api';
import { fixtureIds } from '../../lib/api/fixtures';
import { createMockClient } from '../../lib/api/mock-client';
import {
  MOCK_EXPLORER,
  pendingMint,
  provenanceFixtureIds,
} from '../../lib/api/provenance-fixtures';
import { NftPanel } from './NftPanel';
import { POLL_MAX_ATTEMPTS } from './use-provenance';

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/** The mock client with spies, so tests observe every gateway call. */
function spyClient(overrides: Partial<ApiClient> = {}) {
  const base = createMockClient();
  const client = { ...base, ...overrides };
  const getProvenance = vi.spyOn(client, 'getProvenance');
  const mintItem = vi.spyOn(client, 'mintItem');
  return { client, getProvenance, mintItem };
}

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, {
    code,
    message: 'Upstream message',
    requestId: `req-${String(status)}`,
  });
}

/** Lets pending promises settle and advances the fake clock. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function status() {
  return screen.getByRole('status');
}

function certifyButton() {
  return screen.getByRole('button', {
    name: /Certifier sur la blockchain|Certification en cours|Relancer|Envoi/,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NftPanel provenance states', () => {
  it('shows that no certificate exists, without action for a visitor', async () => {
    const { client } = spyClient();
    render(
      <NftPanel
        contentId={fixtureIds.textile}
        isOwner={false}
        client={client}
      />,
    );
    await flush();

    expect(status()).toHaveTextContent('Aucun certificat');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/ni à vendre|pas à vendre/)).toBeInTheDocument();
    expect(screen.getByText(/ne prouve ni l’authenticité/)).toBeInTheDocument();
  });

  it('shows a confirmed certificate with explorer, IPFS and hash references', async () => {
    const { client } = spyClient();
    render(
      <NftPanel
        contentId={fixtureIds.sculpture}
        isOwner={false}
        client={client}
      />,
    );
    await flush();

    expect(status()).toHaveTextContent('Certificat confirmé');
    expect(screen.getByText('Vérifié sur la blockchain')).toBeInTheDocument();
    expect(
      screen.getByText(/empreinte SHA-256 de l’image originale correspond/),
    ).toBeInTheDocument();

    const tx = `0x${'01'.repeat(32)}`;
    const txLink = screen.getByRole('link', {
      name: new RegExp(`Transaction ${tx}`),
    });
    expect(txLink).toHaveAttribute('href', `${MOCK_EXPLORER}/tx/${tx}`);
    expect(txLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(txLink).toHaveTextContent('0x0101…0101');
    expect(screen.getByRole('link', { name: /Jeton n° 1/ })).toHaveTextContent(
      'n° 1',
    );
    expect(
      screen.getByRole('link', { name: /Métadonnées du certificat/ }),
    ).toHaveTextContent('ipfs://bafkreimockmetadata0001');
    expect(
      screen.getByText('Empreinte SHA-256 de l’image originale'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Galerie LOVA \(garde\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains a mismatch between the chain and the gallery record', async () => {
    const { client } = spyClient();
    render(
      <NftPanel
        contentId={provenanceFixtureIds.mismatch}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    expect(screen.getByText('Incohérence détectée')).toBeInTheDocument();
    expect(
      screen.getByText(/ne correspond pas à celle de l’image/),
    ).toBeInTheDocument();
  });

  it('shows the stored record as unverifiable when the chain cannot be read', async () => {
    const { client } = spyClient();
    render(
      <NftPanel
        contentId={provenanceFixtureIds.unverifiable}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    expect(screen.getByText('Vérification indisponible')).toBeInTheDocument();
    expect(screen.getByText(/n’a pas pu être consultée/)).toBeInTheDocument();
  });

  it('shows a failed mint with its public code and a retry for the owner only', async () => {
    const { client } = spyClient();
    const view = render(
      <NftPanel
        contentId={fixtureIds.painting}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    expect(status()).toHaveTextContent('La certification a échoué');
    expect(status()).toHaveTextContent('Le réseau blockchain est injoignable');
    expect(status()).toHaveTextContent('code CHAIN_UNAVAILABLE');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    view.unmount();
    render(
      <NftPanel contentId={fixtureIds.painting} isOwner client={client} />,
    );
    await flush();
    expect(
      screen.getByRole('button', { name: 'Relancer la certification' }),
    ).toBeEnabled();
  });

  it('hides itself from visitors when the item is not published', async () => {
    const { client } = spyClient();
    const view = render(
      <NftPanel contentId={fixtureIds.draft} isOwner={false} client={client} />,
    );
    await flush();
    expect(view.container).toBeEmptyDOMElement();

    view.unmount();
    render(<NftPanel contentId={fixtureIds.draft} isOwner client={client} />);
    await flush();
    expect(screen.getByText(/une fois l’œuvre publiée/)).toBeInTheDocument();
  });

  it('offers a retry when provenance cannot be loaded', async () => {
    const { client, getProvenance } = spyClient();
    getProvenance.mockRejectedValueOnce(apiError(503, 'NFT_UNAVAILABLE'));
    render(
      <NftPanel
        contentId={fixtureIds.sculpture}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('n’a pas pu être chargé');
    expect(alert).toHaveTextContent('req-503');

    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await flush();
    expect(status()).toHaveTextContent('Certificat confirmé');
  });
});

describe('NftPanel mint and polling', () => {
  it('mints for the owner, polls with backoff and shows the confirmation', async () => {
    const { client, getProvenance, mintItem } = spyClient();
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    expect(getProvenance).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Certifier sur la blockchain' }),
    );
    expect(certifyButton()).toBeDisabled();
    await flush();

    const [contentId, key] = mintItem.mock.calls[0] ?? [];
    expect(contentId).toBe(fixtureIds.textile);
    expect(key).toMatch(KEY_PATTERN);
    expect(status()).toHaveTextContent('Certification en cours');
    expect(
      screen.getByRole('button', { name: 'Certification en cours…' }),
    ).toBeDisabled();

    // The mock reads the mint once more as pending, then confirms it.
    await flush(999);
    expect(getProvenance).toHaveBeenCalledTimes(1);
    await flush(1);
    expect(getProvenance).toHaveBeenCalledTimes(2);
    expect(status()).toHaveTextContent('Certification en cours');
    await flush(2_000);
    expect(getProvenance).toHaveBeenCalledTimes(3);
    expect(status()).toHaveTextContent('Certificat confirmé');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    // A final state stops the polling and ends the intent.
    await flush(60_000);
    expect(getProvenance).toHaveBeenCalledTimes(3);
    expect(
      window.sessionStorage.getItem(`lova:mint-key:${fixtureIds.textile}`),
    ).toBeNull();
  });

  it('reuses the same idempotency key on retry and after a reload', async () => {
    const { client, mintItem } = spyClient();
    mintItem.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mintItem.mockRejectedValueOnce(apiError(503, 'NFT_UNAVAILABLE'));
    const view = render(
      <NftPanel contentId={fixtureIds.textile} isOwner client={client} />,
    );
    await flush();

    fireEvent.click(certifyButton());
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'sans risque de doublon',
    );
    fireEvent.click(certifyButton());
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('req-503');

    // A reload remounts the panel; the key comes back from sessionStorage.
    view.unmount();
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    fireEvent.click(certifyButton());
    await flush();

    const keys = mintItem.mock.calls.map((call) => call[1]);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(status()).toHaveTextContent('Certification en cours');
  });

  it('starts a new intent with a new key after a failed mint', async () => {
    const { client, mintItem } = spyClient();
    window.sessionStorage.setItem(
      `lova:mint-key:${fixtureIds.painting}`,
      'old-key-of-failed-mint',
    );
    render(
      <NftPanel contentId={fixtureIds.painting} isOwner client={client} />,
    );
    await flush();

    fireEvent.click(
      screen.getByRole('button', { name: 'Relancer la certification' }),
    );
    await flush();
    expect(mintItem.mock.calls[0]?.[1]).not.toBe('old-key-of-failed-mint');
    expect(status()).toHaveTextContent('Certification en cours');
  });

  it('stops polling on unmount', async () => {
    const { client, getProvenance } = spyClient();
    const view = render(
      <NftPanel
        contentId={provenanceFixtureIds.pending}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    expect(status()).toHaveTextContent('Certification en cours');
    expect(getProvenance).toHaveBeenCalledTimes(1);

    view.unmount();
    await flush(120_000);
    expect(getProvenance).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through errors and asks for a refresh after the last attempt', async () => {
    const { client, getProvenance } = spyClient();
    const pending = {
      contentId: fixtureIds.textile,
      mint: pendingMint(fixtureIds.textile, 9),
      scope: '',
    };
    // Load, then a failing first poll, then pending forever.
    getProvenance.mockResolvedValue(pending);
    getProvenance.mockResolvedValueOnce(pending);
    getProvenance.mockRejectedValueOnce(apiError(503, 'NFT_UNAVAILABLE'));
    render(
      <NftPanel
        contentId={fixtureIds.textile}
        isOwner={false}
        client={client}
      />,
    );
    await flush();
    await flush(1_000);
    expect(getProvenance).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText(/nouvelle tentative automatique/),
    ).toBeInTheDocument();

    await flush(15_000 * POLL_MAX_ATTEMPTS);
    expect(getProvenance).toHaveBeenCalledTimes(1 + POLL_MAX_ATTEMPTS);
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await flush();
    expect(getProvenance).toHaveBeenCalledTimes(2 + POLL_MAX_ATTEMPTS);
  });
});

describe('NftPanel mint responses', () => {
  const replayed: MintResult = {
    created: false,
    mint: pendingMint(fixtureIds.textile, 7),
  };

  it('tells the owner when a replayed key returned the existing request (200)', async () => {
    const { client } = spyClient({ mintItem: () => Promise.resolve(replayed) });
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    fireEvent.click(certifyButton());
    await flush();
    expect(status()).toHaveTextContent('Votre demande était déjà enregistrée');
  });

  it('shows the existing request on 409 and reloads the provenance', async () => {
    const { client, getProvenance, mintItem } = spyClient();
    mintItem.mockRejectedValueOnce(apiError(409, 'MINT_ALREADY_REQUESTED'));
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    fireEvent.click(certifyButton());
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'déjà un certificat ou une demande',
    );
    expect(getProvenance).toHaveBeenCalledTimes(2);
    expect(
      window.sessionStorage.getItem(`lova:mint-key:${fixtureIds.textile}`),
    ).toBeNull();
  });

  it('explains a 403 without retrying', async () => {
    const { client, mintItem } = spyClient();
    mintItem.mockRejectedValueOnce(apiError(403, 'FORBIDDEN'));
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    fireEvent.click(certifyButton());
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Seul le ou la propriétaire',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Upstream message');
    expect(
      window.sessionStorage.getItem(`lova:mint-key:${fixtureIds.textile}`),
    ).toBeNull();
  });

  it('sends a signed-out owner to sign-in and keeps the key (401)', async () => {
    window.history.replaceState(null, '', '/oeuvre/abc');
    const { client, mintItem } = spyClient();
    mintItem.mockRejectedValueOnce(apiError(401, 'UNAUTHENTICATED'));
    render(<NftPanel contentId={fixtureIds.textile} isOwner client={client} />);
    await flush();
    fireEvent.click(certifyButton());
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Connectez-vous');
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?retour=%2Foeuvre%2Fabc',
    );
    expect(
      window.sessionStorage.getItem(`lova:mint-key:${fixtureIds.textile}`),
    ).toMatch(KEY_PATTERN);
  });
});
