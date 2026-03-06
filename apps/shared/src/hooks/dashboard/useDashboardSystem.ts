import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type {
  DashboardAdguardSummaryResponse,
  DashboardScrutinySummaryResponse,
  DashboardNetdataSummaryResponse,
} from '../../types';

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

export function useDashboardAdguardSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.adguardSummary(),
    queryFn: () => fetcher<DashboardAdguardSummaryResponse>(DASHBOARD_ENDPOINTS.ADGUARD.SUMMARY),
  });
}
