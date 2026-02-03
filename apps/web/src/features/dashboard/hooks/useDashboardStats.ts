import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { dashboardApi } from "../api";

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: dashboardApi.getDashboardStats,
  });
}
