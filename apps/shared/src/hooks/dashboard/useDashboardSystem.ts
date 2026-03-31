import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type {
  DashboardAdguardSummaryResponse,
  DashboardScrutinySummaryResponse,
  DashboardBeszelSummaryResponse,
} from '../../types';

export function useDashboardScrutinySummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.scrutinySummary(),
    queryFn: () => fetcher<DashboardScrutinySummaryResponse>(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
  });
}

export function useDashboardBeszelSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.beszelSummary(),
    queryFn: () => fetcher<DashboardBeszelSummaryResponse>(DASHBOARD_ENDPOINTS.BESZEL.SUMMARY),
  });
}

export function useDashboardAdguardSummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.adguardSummary(),
    queryFn: () => fetcher<DashboardAdguardSummaryResponse>(DASHBOARD_ENDPOINTS.ADGUARD.SUMMARY),
  });
}
