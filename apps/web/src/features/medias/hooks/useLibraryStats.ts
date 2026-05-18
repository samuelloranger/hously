import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@/lib/endpoints";
import type { LibraryStatsResponse } from "@hously/shared/types";

export function useLibraryStats() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.library.stats(),
    queryFn: () =>
      fetcher<LibraryStatsResponse>(LIBRARY_ENDPOINTS.LIBRARY_STATS),
    staleTime: 60_000,
  });
}
