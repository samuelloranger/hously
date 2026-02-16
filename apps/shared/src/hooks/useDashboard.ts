import { useQuery, useMutation } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys, DASHBOARD_ENDPOINTS } from '../index';
import type {
  DashboardStatsResponse,
  DashboardJellyfinLatestResponse,
  DashboardUpcomingResponse,
  DashboardQbittorrentStatusResponse,
} from '../types';

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

export function useDashboardJellyfinLatest(limit: number = 10) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.jellyfinLatest(limit),
    queryFn: () => fetcher<DashboardJellyfinLatestResponse>(`${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${limit}`),
  });
}

export function useDashboardUpcoming(limit: number = 8) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.upcoming(limit),
    queryFn: () => fetcher<DashboardUpcomingResponse>(`${DASHBOARD_ENDPOINTS.UPCOMING.LIST}?limit=${limit}`),
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

export function useDashboardQbittorrentStatus() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentStatus(),
    queryFn: () => fetcher<DashboardQbittorrentStatusResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.STATUS),
  });
}
