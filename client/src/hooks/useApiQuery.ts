import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { toApiError, type ApiError } from '../lib/api';

export interface QueryState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: (current: T | null) => T | null) => void;
}

/** Runs `fetcher` whenever deps change; stale responses from earlier runs are ignored. */
export function useApiQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList): QueryState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Drop previous result so identity/filter changes never flash stale data (e.g. passport after login).
    setDataState(null);
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDataState(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(toApiError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: (current: T | null) => T | null) => setDataState(updater), []);
  return { data, error, loading, reload, setData };
}
