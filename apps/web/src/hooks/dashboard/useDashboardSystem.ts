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

export function useDashboardBeszelSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.beszelSummary(),
    queryFn: () =>
      fetcher<DashboardBeszelSummaryResponse>(
        DASHBOARD_ENDPOINTS.BESZEL.SUMMARY,
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
