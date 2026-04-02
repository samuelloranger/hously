import { useUrlState, type UrlStateRecord } from '@/hooks/useUrlState';

/**
 * Reusable hook for syncing modal state to URL search params.
 * Supports the browser back button by using navigate with replace: false.
 *
 * @param from - The route ID (e.g., '/library')
 * @param search - Current search params from useSearch()
 */
export function useModalSearchParams<T extends UrlStateRecord>(from: string, search: T) {
  const { setState, resetState } = useUrlState(from, search, {} as T);

  return { setParams: setState, resetParams: resetState };
}
