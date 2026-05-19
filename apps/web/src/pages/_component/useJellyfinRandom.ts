import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { JellyfinRandomResponse } from "@hously/shared/types";

export function useJellyfinRandom() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.jellyfinRandom(),
    queryFn: () =>
      fetcher<JellyfinRandomResponse>(DASHBOARD_ENDPOINTS.JELLYFIN.RANDOM),
    staleTime: 0,
    gcTime: 0,
  });
}
