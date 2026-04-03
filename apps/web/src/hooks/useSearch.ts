import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { SEARCH_ENDPOINTS } from "@hously/shared";
import type { QuickSearchResponse } from "@hously/shared";

export function useQuickSearch(
  query: string,
  options?: Omit<UseQueryOptions<QuickSearchResponse>, "queryKey" | "queryFn">,
) {
  const fetcher = useFetcher();

  return useQuery<QuickSearchResponse>({
    queryKey: queryKeys.search.quick(query),
    queryFn: () =>
      fetcher<QuickSearchResponse>(
        `${SEARCH_ENDPOINTS.QUICK}?q=${encodeURIComponent(query)}&limit=6`,
      ),
    ...options,
  });
}
