import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

/**
 * Reusable hook for syncing modal state to URL search params.
 * Supports the browser back button by using navigate with replace: false.
 *
 * @param from - The route ID (e.g., '/library')
 * @param search - Current search params from useSearch()
 */
export function useModalSearchParams<T extends Record<string, unknown>>(
  from: string,
  search: T,
) {
  const navigate = useNavigate();

  const setParams = useCallback(
    (updates: Partial<T>) => {
      navigate({
        to: from,
        search: { ...search, ...updates } as T,
        replace: false,
      });
    },
    [navigate, from, search],
  );

  const resetParams = useCallback(
    (keys: (keyof T)[]) => {
      const next = { ...search };
      for (const key of keys) {
        next[key] = undefined as T[keyof T];
      }
      navigate({
        to: from,
        search: next,
        replace: false,
      });
    },
    [navigate, from, search],
  );

  return { setParams, resetParams };
}
