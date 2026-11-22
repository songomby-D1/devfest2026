import { ApiError, type ApiClient } from './client';
import type { Generation } from './contract';

type GenerationHandlers = Pick<
  ApiClient,
  'createGeneration' | 'getGeneration' | 'listGenerations'
>;

export interface MockGenerationOptions {
  /** Throws the public 401 for a guest; returns the signed-in user ID. */
  requireUserId: () => string;
  respond: <T>(produce: () => T) => Promise<T>;
  nextRequestId: () => string;
  createId: () => string;
  now?: () => number;
}

/** A mock generation takes this long, so the progress screen can be rehearsed. */
export const MOCK_GENERATION_MS = 18_000;
const SAMPLE_MODEL = '/models/exposition/sobika.glb';
const SAMPLE_POSTER = '/models/exposition/sobika.webp';

interface Entry {
  readonly ownerId: string;
  readonly id: string;
  readonly title: string;
  readonly startedAt: number;
}

/**
 * Image-to-3D routes of the mock client. Progress follows the clock, and a
 * finished generation answers with a bundled sample model instead of
 * calling Meshy.
 */
export function createMockGenerations({
  requireUserId,
  respond,
  nextRequestId,
  createId,
  now = () => Date.now(),
}: MockGenerationOptions): GenerationHandlers {
  const entries = new Map<string, Entry>();

  function view(entry: Entry): Generation {
    const ratio = Math.min(1, (now() - entry.startedAt) / MOCK_GENERATION_MS);
    const ready = ratio >= 1;
    return {
      id: entry.id,
      title: entry.title,
      status: ready
        ? 'ready'
        : ratio < 0.1
          ? 'queued'
          : ratio < 0.92
            ? 'modeling'
            : 'storing',
      progress: Math.round(ratio * 100),
      modelUrl: ready ? SAMPLE_MODEL : null,
      posterUrl: ready ? SAMPLE_POSTER : null,
      errorCode: null,
      createdAt: new Date(entry.startedAt).toISOString(),
    };
  }

  function find(id: string): Entry {
    const entry = entries.get(id);
    if (entry?.ownerId !== requireUserId()) {
      throw new ApiError(404, {
        code: 'NOT_FOUND',
        message: 'The generation was not found.',
        requestId: nextRequestId(),
      });
    }
    return entry;
  }

  return {
    createGeneration: (request) =>
      respond(() => {
        const ownerId = requireUserId();
        if (!request.image.startsWith('data:image/')) {
          throw new ApiError(400, {
            code: 'IMAGE_INVALID',
            message: 'The image must be a JPEG, PNG or WebP file.',
            requestId: nextRequestId(),
          });
        }
        const entry: Entry = {
          ownerId,
          id: createId(),
          title: request.title ?? 'Œuvre générée',
          startedAt: now(),
        };
        entries.set(entry.id, entry);
        return view(entry);
      }),
    getGeneration: (id) => respond(() => view(find(id))),
    listGenerations: () =>
      respond(() => {
        const ownerId = requireUserId();
        return [...entries.values()]
          .filter((entry) => entry.ownerId === ownerId)
          .sort((a, b) => b.startedAt - a.startedAt)
          .map(view);
      }),
  };
}
