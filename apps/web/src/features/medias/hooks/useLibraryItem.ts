import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@/lib/endpoints";
import type { LibraryItemResponse } from "@hously/shared/types";

/**
 * Fetch a single library item by its id.
 *
 * The detail page uses this as its source of truth instead of mining the
 * library-list cache. A freshly-added item gets a brand-new query key with no
 * stale cache entry, so it always loads on mount — even under the app's global
 * `refetchOnMount: false` default. That is what makes "open the movie right
 * after adding it" work without a hard reload.
 */
export function useLibraryItem(
  id: number,
  options?: { staleTime?: number; gcTime?: number },
) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.library.item(id),
    queryFn: () => fetcher<LibraryItemResponse>(LIBRARY_ENDPOINTS.ITEM(id)),
    enabled: Number.isFinite(id),
    ...options,
  });
}
