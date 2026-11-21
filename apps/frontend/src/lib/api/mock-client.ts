import { ApiError, type ApiClient } from './client';
import type {
  ContentId,
  Item,
  MintResult,
  Model3d,
  Provenance,
} from './contract';
import { fixtureItems, fixtureModels, fixtureProvenance } from './fixtures';

export interface MockClientOptions {
  /** Simulated network latency in milliseconds. */
  latencyMs?: number;
  createId?: () => ContentId;
}

let requestCounter = 0;

function notFound(): ApiError {
  requestCounter += 1;
  return new ApiError(404, {
    code: 'NOT_FOUND',
    message: 'Cette œuvre est introuvable.',
    requestId: `mock-${String(requestCounter)}`,
  });
}

/**
 * In-memory implementation of the gateway contract. Each client owns a copy of
 * the fixtures, so tests stay isolated. A mint stays `pending` on the request
 * and is confirmed on the next provenance read, like a polled transaction.
 */
export function createMockClient(options: MockClientOptions = {}): ApiClient {
  const { latencyMs = 0, createId = () => crypto.randomUUID() } = options;
  const items = new Map<ContentId, Item>(
    fixtureItems.map((item) => [item.id, structuredClone(item)]),
  );
  const models = new Map<ContentId, Model3d>(
    fixtureModels.map((model) => [model.contentId, structuredClone(model)]),
  );
  const provenance = new Map<ContentId, Provenance>(
    fixtureProvenance.map((entry) => [entry.contentId, structuredClone(entry)]),
  );
  const mintsByKey = new Map<string, MintResult>();

  async function respond<T>(produce: () => T): Promise<T> {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
    return structuredClone(produce());
  }

  function findItem(id: ContentId): Item {
    const item = items.get(id);
    if (!item) throw notFound();
    return item;
  }

  return {
    listItems: () =>
      respond(() => ({
        items: [...items.values()].filter(
          (item) => item.publicationStatus === 'published',
        ),
      })),
    getItem: (id) => respond(() => findItem(id)),
    createItem: (newItem) =>
      respond(() => {
        const item: Item = {
          ...newItem,
          id: createId(),
          publicationStatus: 'draft',
          claims: { item: 'unreviewed', description: 'unreviewed' },
          imageUrl: '',
        };
        items.set(item.id, item);
        return item;
      }),
    uploadMedia: (id, file) =>
      respond(() => {
        const item = findItem(id);
        item.imageUrl = URL.createObjectURL(file);
        return item;
      }),
    reviewItem: (id, decision) =>
      respond(() => {
        const item = findItem(id);
        item.claims = { ...decision };
        return item;
      }),
    mintItem: (id, idempotencyKey) =>
      respond(() => {
        findItem(id);
        const previous = mintsByKey.get(idempotencyKey);
        if (previous) return previous;
        const result: MintResult = { contentId: id, status: 'pending' };
        mintsByKey.set(idempotencyKey, result);
        provenance.set(id, { contentId: id, mint: 'pending' });
        return result;
      }),
    getProvenance: (id) =>
      respond(() => {
        findItem(id);
        const entry = provenance.get(id) ?? { contentId: id, mint: null };
        if (entry.mint === 'pending') {
          entry.mint = 'confirmed';
          entry.tokenId = String(provenance.size);
        }
        return entry;
      }),
    getModel3d: (id) =>
      respond(() => {
        findItem(id);
        return models.get(id) ?? { contentId: id, status: 'missing' as const };
      }),
  };
}
