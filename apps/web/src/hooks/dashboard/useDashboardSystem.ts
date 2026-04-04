import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared";
import type {
  DashboardAdguardSummaryResponse,
  DashboardScrutinySummaryResponse,
  DashboardBeszelSummaryResponse,
} from "@hously/shared";

export function useDashboardScrutinySummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.scrutinySummary(),
    queryFn: () =>
      fetcher<DashboardScrutinySummaryResponse>(
        DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY,
      ),
  });
}

export function useDashboardSystemSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.systemSummary(),
    queryFn: () =>
      fetcher<DashboardBeszelSummaryResponse>(
        DASHBOARD_ENDPOINTS.SYSTEM.SUMMARY,
      ),
  });
}

export function useDashboardAdguardSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.adguardSummary(),
    queryFn: () =>
      fetcher<DashboardAdguardSummaryResponse>(
        DASHBOARD_ENDPOINTS.ADGUARD.SUMMARY,
      ),
  });
}
