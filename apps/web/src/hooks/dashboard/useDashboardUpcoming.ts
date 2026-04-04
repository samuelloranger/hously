import { useMutation, useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared";
import type { DashboardUpcomingResponse } from "@hously/shared";

export function useDashboardUpcoming(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.upcoming(),
    queryFn: () =>
      fetcher<DashboardUpcomingResponse>(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
    enabled: options?.enabled ?? true,
  });
}

export function useAddUpcomingToArr() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: {
      media_type: "movie" | "tv";
      tmdb_id: number;
      search_on_add: boolean;
    }) =>
      fetcher<{
        success: boolean;
        service: "radarr" | "sonarr";
        added: boolean;
        already_exists: boolean;
      }>(DASHBOARD_ENDPOINTS.UPCOMING.ADD, {
        method: "POST",
        body: data,
      }),
  });
}
