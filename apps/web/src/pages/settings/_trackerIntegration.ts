import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS, INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type {
  DashboardTrackerStatsResponse,
  DashboardTrackersStatsResponse,
  TrackerIntegration,
  TrackerIntegrationUpdateResponse,
  TrackerType,
} from "@hously/shared/types";

const TRACKER_INTEGRATION_ENDPOINTS: Record<TrackerType, string> = {
  c411: INTEGRATION_ENDPOINTS.C411,
  torr9: INTEGRATION_ENDPOINTS.TORR9,
  "la-cale": INTEGRATION_ENDPOINTS.LA_CALE,
  "ygg-reborn": INTEGRATION_ENDPOINTS.YGG_REBORN,
};

const getDashboardTrackersStatsQuery = (
  fetcher: ReturnType<typeof useFetcher>,
  enabled = true,
) => ({
  queryKey: queryKeys.dashboard.trackersStats(),
  queryFn: () =>
    fetcher<DashboardTrackersStatsResponse>(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
  enabled,
  staleTime: 60 * 60 * 1000,
});

export function useTrackerIntegration<T extends TrackerType>(type: T) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.tracker(type),
    queryFn: () =>
      fetcher<{ integration: TrackerIntegration & { type: T } }>(
        TRACKER_INTEGRATION_ENDPOINTS[type],
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateTrackerIntegration(type: TrackerType) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      flaresolverr_url: string;
      tracker_url: string;
      username: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<TrackerIntegrationUpdateResponse>(
        TRACKER_INTEGRATION_ENDPOINTS[type],
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.tracker(type),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.trackersStats(),
      });
    },
  });
}

export function useDashboardTrackerStats(
  type: TrackerType,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  return useQuery({
    ...getDashboardTrackersStatsQuery(fetcher, options?.enabled ?? true),
    select: (data) => data[type] satisfies DashboardTrackerStatsResponse,
  });
}
