import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { dashboardApi } from "../api";

export function useDashboardActivities() {
  return useQuery({
    queryKey: queryKeys.dashboard.activities(),
    queryFn: dashboardApi.getDashboardActivities,
  });
}
