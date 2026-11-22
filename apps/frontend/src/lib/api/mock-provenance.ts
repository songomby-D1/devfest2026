import { ApiError, type ApiClient } from './client';
import type { ContentId, Model3d, Provenance, ProvenanceMint } from './contract';
import {
  confirmedMint,
  fixtureModels,
  fixtureProvenance,
  noMint,
  pendingMint,
  PROVENANCE_SCOPE,
} from './provenance-fixtures';

type ProvenanceHandlers = Pick<
  ApiClient,
  'mintItem' | 'getProvenance' | 'getModel3d'
>;

export interface MockProvenanceOptions {
  /** Throws the public 404 when the item is unknown or not published. */
  assertPublished: (id: ContentId) => void;
  respond: <T>(produce: () => T) => Promise<T>;
  nextRequestId: () => string;
}

/**
 * Mint, provenance and 3D routes of the mock client. A pending mint is read
 * once more as `pending`, then confirmed on the following provenance read,
 * like a polled transaction. Like the NFT service, a replayed key returns
 * the same mint (200), a new key on an item with a live or confirmed mint is
 * a 409, and a key reused for another item is a 422.
 */
export function createMockProvenance({
  assertPublished,
  respond,
  nextRequestId,
}: MockProvenanceOptions): ProvenanceHandlers {
  const provenance = new Map<ContentId, Provenance>(
    fixtureProvenance.map((entry) => [entry.contentId, structuredClone(entry)]),
  );
  const models = new Map<ContentId, Model3d>(
    fixtureModels.map((model) => [model.contentId, structuredClone(model)]),
  );
  const mintsByKey = new Map<string, ProvenanceMint>();
  let seed = 100;

  function assertKnown(id: ContentId): void {
    if (!provenance.has(id)) assertPublished(id);
  }

  function error(status: number, code: string, message: string): ApiError {
    return new ApiError(status, {
      code,
      message,
      requestId: nextRequestId(),
    });
  }

  return {
    mintItem: (id, idempotencyKey) =>
      respond(() => {
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
          throw error(
            400,
            'IDEMPOTENCY_KEY_REQUIRED',
            'An Idempotency-Key header of 16 to 128 letters, digits, "-" or "_" is required',
          );
        }
        const replay = mintsByKey.get(idempotencyKey);
        if (replay) {
          if (replay.contentId !== id) {
            throw error(
              422,
              'IDEMPOTENCY_KEY_REUSED',
              'This Idempotency-Key was already used for another item',
            );
          }
          return {
            created: false,
            mint: provenance.get(id)?.mint ?? replay,
          };
        }
        assertKnown(id);
        const current = provenance.get(id)?.mint;
        if (current && current.status !== 'failed') {
          throw error(
            409,
            'MINT_ALREADY_REQUESTED',
            'This item already has a certificate or a request in progress',
          );
        }
        seed += 1;
        const mint = pendingMint(id, seed, new Date().toISOString());
        mintsByKey.set(idempotencyKey, mint);
        provenance.set(id, { contentId: id, mint, scope: PROVENANCE_SCOPE });
        return { created: true, mint };
      }),
    getProvenance: (id) =>
      respond(() => {
        assertKnown(id);
        const entry = provenance.get(id) ?? noMint(id);
        const current = entry.mint;
        if (current?.status === 'pending') {
          const tokenSeed = Number(current.mintId.slice(-12)) || 1;
          provenance.set(id, {
            ...entry,
            mint: confirmedMint(current, tokenSeed),
          });
        }
        return entry;
      }),
    // Like the gateway, an unknown item has a `missing` model, not a 404.
    getModel3d: (id) =>
      respond(() => {
        return (
          models.get(id) ?? { contentId: id, status: 'missing', variants: null }
        );
      }),
  };
}
