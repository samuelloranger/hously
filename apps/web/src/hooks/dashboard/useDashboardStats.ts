import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '@/lib/api/context';
import { queryKeys } from '@/lib/queryKeys';
import { DASHBOARD_ENDPOINTS } from '@hously/shared';
import type { DashboardActivityFeedResponse, DashboardStatsResponse } from '@hously/shared';

export function useDashboardStats() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => fetcher<DashboardStatsResponse>(DASHBOARD_ENDPOINTS.STATS),
  });
}

function useDashboardActivities(limit?: number) {
  const fetcher = useFetcher();

  const params = limit ? `?limit=${limit}` : '';

  return useQuery({
    queryKey: queryKeys.dashboard.activities(limit),
    queryFn: () =>
      fetcher<{ activities: DashboardStatsResponse['activities'] }>(`${DASHBOARD_ENDPOINTS.ACTIVITIES}${params}`),
  });
}

export function useDashboardActivityFeed(params: { limit?: number; service?: string; type?: string } = {}) {
  const fetcher = useFetcher();
  const search = new URLSearchParams();

  if (params.limit) search.set('limit', String(params.limit));
  if (params.service) search.set('service', params.service);
  if (params.type) search.set('type', params.type);

  const query = search.toString();
  const endpoint = query ? `${DASHBOARD_ENDPOINTS.ACTIVITIES_FEED}?${query}` : DASHBOARD_ENDPOINTS.ACTIVITIES_FEED;

  return useQuery({
    queryKey: queryKeys.dashboard.activityFeed(params),
    queryFn: () => fetcher<DashboardActivityFeedResponse>(endpoint),
  });
}
