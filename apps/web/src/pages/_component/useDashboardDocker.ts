import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { DashboardDockerSummaryResponse } from "@hously/shared/types";

export function useDashboardDockerSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.dockerSummary(),
    queryFn: () =>
      fetcher<DashboardDockerSummaryResponse>(
        DASHBOARD_ENDPOINTS.DOCKER.SUMMARY,
      ),
  });
}
