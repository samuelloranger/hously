import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type {
  DashboardYggStatsResponse,
  DashboardTrackersStatsResponse,
  DashboardScrutinySummaryResponse,
  DashboardNetdataSummaryResponse,
} from '../../types';

export function useDashboardYggStats(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.trackersStats(),
    queryFn: () => fetcher<DashboardTrackersStatsResponse>(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 60 * 1000,
    select: data => data.ygg satisfies DashboardYggStatsResponse,
  });
}

export function useDashboardScrutinySummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.scrutinySummary(),
    queryFn: () => fetcher<DashboardScrutinySummaryResponse>(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
  });
}

export function useDashboardNetdataSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.netdataSummary(),
    queryFn: () => fetcher<DashboardNetdataSummaryResponse>(DASHBOARD_ENDPOINTS.NETDATA.SUMMARY),
  });
}
