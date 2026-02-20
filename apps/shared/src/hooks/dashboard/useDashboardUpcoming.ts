import { useMutation, useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardUpcomingResponse } from '../../types';

export function useDashboardUpcoming(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.upcoming(),
    queryFn: () => fetcher<DashboardUpcomingResponse>(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
    enabled: options?.enabled ?? true,
  });
}

export function useAddUpcomingToArr() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: { media_type: 'movie' | 'tv'; tmdb_id: number; search_on_add: boolean }) =>
      fetcher<{
        success: boolean;
        service: 'radarr' | 'sonarr';
        added: boolean;
        already_exists: boolean;
      }>(DASHBOARD_ENDPOINTS.UPCOMING.ADD, {
        method: 'POST',
        body: data,
      }),
  });
}

export function useUpcomingStatus() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: { media_type: 'movie' | 'tv'; tmdb_id: number }) =>
      fetcher<{ exists: boolean; service: 'radarr' | 'sonarr' }>(DASHBOARD_ENDPOINTS.UPCOMING.STATUS, {
        method: 'POST',
        body: data,
      }),
  });
}
