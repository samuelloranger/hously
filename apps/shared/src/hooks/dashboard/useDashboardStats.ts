import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardStatsResponse } from '../../types';

export function useDashboardStats() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => fetcher<DashboardStatsResponse>(DASHBOARD_ENDPOINTS.STATS),
  });
}

export function useDashboardActivities(limit?: number) {
  const fetcher = useFetcher();

  const params = limit ? `?limit=${limit}` : '';

  return useQuery({
    queryKey: queryKeys.dashboard.activities(limit),
    queryFn: () =>
      fetcher<{ activities: DashboardStatsResponse['activities'] }>(`${DASHBOARD_ENDPOINTS.ACTIVITIES}${params}`),
  });
}
