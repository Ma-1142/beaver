'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions<T> {
  fetchFn: () => Promise<T>;
  intervalMs?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseAutoRefreshReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useAutoRefresh<T>({
  fetchFn,
  intervalMs = 30000,
  enabled = true,
  onError,
}: UseAutoRefreshOptions<T>): UseAutoRefreshReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, onError]);

  useEffect(() => {
    // Always do initial fetch
    refresh();

    // Only set up interval if enabled
    if (enabled && intervalMs > 0) {
      intervalRef.current = setInterval(refresh, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh, intervalMs, enabled]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
