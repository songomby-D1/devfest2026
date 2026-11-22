import { useCallback, useEffect, useState } from 'react';

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

export interface ResourceHandle<T> {
  state: Resource<T>;
  reload: () => void;
  /** Replaces the data, for example with the item an action returned. */
  setData: (data: T) => void;
}

/**
 * Loads data for a screen and keeps the loading, ready and error states. A
 * newer load or an unmount discards the result of an older one.
 */
export function useResource<T>(
  load: () => Promise<T>,
  key: string,
): ResourceHandle<T> {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
    // `load` is recreated on each render; `key` and `attempt` say when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- FE-03: keyed reload
  }, [key, attempt]);

  const reload = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);
  const setData = useCallback((data: T) => {
    setState({ status: 'ready', data });
  }, []);

  return { state, reload, setData };
}
