import { ApiError, type ApiClient } from './client';
import type { ContentId, Item } from './contract';
import { fixtureItems } from './fixtures';
import { createMockProvenance } from './mock-provenance';

export interface MockClientOptions {
  /** Simulated network latency in milliseconds. */
  latencyMs?: number;
  createId?: () => ContentId;
}

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `mock-${String(requestCounter)}`;
}

function notFound(): ApiError {
  return new ApiError(404, {
    code: 'NOT_FOUND',
    message: 'Cette œuvre est introuvable.',
    requestId: nextRequestId(),
  });
}

/**
 * In-memory implementation of the gateway contract. Each client owns a copy of
 * the fixtures, so tests stay isolated. mock-provenance.ts holds the mint,
 * provenance and 3D routes.
 */
export function createMockClient(options: MockClientOptions = {}): ApiClient {
  const { latencyMs = 0, createId = () => crypto.randomUUID() } = options;
  const items = new Map<ContentId, Item>(
    fixtureItems.map((item) => [item.id, structuredClone(item)]),
  );

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
    ...createMockProvenance({
      // Like the NFT service: unknown, draft and unpublished items are the same 404.
      assertPublished: (id) => {
        if (findItem(id).publicationStatus !== 'published') throw notFound();
      },
      respond,
      nextRequestId,
    }),
  };
}
