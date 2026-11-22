import { useCallback, useEffect, useRef, useState } from 'react';
import { api, describeError, type Generation } from '../../lib/api';
import { useSession } from '../../lib/session/session';
import { ImagePreparationError, toUploadDataUri } from './image-data-uri';

const POLL_MS = 3000;

export interface GenerationRequest {
  readonly file: File;
  readonly title: string;
  readonly texturePrompt: string;
}

export interface Generations {
  readonly signedIn: boolean;
  readonly sessionKnown: boolean;
  /** Newest first. */
  readonly items: readonly Generation[];
  readonly submitting: boolean;
  readonly error: string | null;
  start: (request: GenerationRequest) => Promise<Generation | null>;
  clearError: () => void;
}

function isRunning(generation: Generation): boolean {
  return (
    generation.status === 'queued' ||
    generation.status === 'modeling' ||
    generation.status === 'storing'
  );
}

/**
 * The visitor's image-to-3D generations. Running ones are polled from the
 * page, so a generation keeps progressing while its panel is closed.
 */
export function useGenerations(): Generations {
  const session = useSession();
  const signedIn = session.status === 'signed-in';
  const [items, setItems] = useState<readonly Generation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const merge = useCallback((updated: Generation) => {
    setItems((current) => {
      const others = current.filter((item) => item.id !== updated.id);
      return [updated, ...others].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    });
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    api.listGenerations().then(
      (list) => {
        if (!cancelled) setItems(list);
      },
      () => {
        // The exhibition works without generations; the panel reports errors on use.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const hasRunning = items.some(isRunning);
  useEffect(() => {
    if (!hasRunning) return undefined;
    const timer = window.setInterval(() => {
      for (const item of itemsRef.current.filter(isRunning)) {
        api.getGeneration(item.id).then(merge, () => {
          // A failed poll is retried on the next tick.
        });
      }
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [hasRunning, merge]);

  const start = useCallback(
    async (request: GenerationRequest): Promise<Generation | null> => {
      setSubmitting(true);
      setError(null);
      try {
        const image = await toUploadDataUri(request.file);
        const title = request.title.trim();
        const texturePrompt = request.texturePrompt.trim();
        const created = await api.createGeneration({
          image,
          ...(title === '' ? {} : { title }),
          ...(texturePrompt === '' ? {} : { texturePrompt }),
        });
        merge(created);
        return created;
      } catch (caught) {
        setError(
          caught instanceof ImagePreparationError
            ? caught.message
            : describeError(caught).message,
        );
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [merge],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    signedIn,
    sessionKnown: session.status === 'signed-in' || session.status === 'guest',
    items,
    submitting,
    error,
    start,
    clearError,
  };
}
