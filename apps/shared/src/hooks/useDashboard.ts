import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../endpoints';
import type {
  DashboardStatsResponse,
  DashboardJellyfinLatestResponse,
  DashboardScrutinySummaryResponse,
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

export function useDashboardJellyfinLatest(limit: number = 10, page: number = 1) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.jellyfinLatest(limit, page),
    queryFn: () =>
      fetcher<DashboardJellyfinLatestResponse>(`${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${limit}&page=${page}`),
  });
}

export function useDashboardUpcoming(limit: number = 8, page: number = 1) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.upcoming(limit, page),
    queryFn: () =>
      fetcher<DashboardUpcomingResponse>(`${DASHBOARD_ENDPOINTS.UPCOMING.LIST}?limit=${limit}&page=${page}`),
  });
}

export function useDashboardJellyfinLatestInfinite(limit: number = 10) {
  const fetcher = useFetcher();

  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.jellyfinLatestInfinite(limit),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 1;
      return fetcher<DashboardJellyfinLatestResponse>(
        `${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${limit}&page=${page}`
      );
    },
    getNextPageParam: lastPage => (lastPage.has_more ? lastPage.page + 1 : undefined),
  });
}

export function useDashboardUpcomingInfinite(limit: number = 8) {
  const fetcher = useFetcher();

  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.upcomingInfinite(limit),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 1;
      return fetcher<DashboardUpcomingResponse>(`${DASHBOARD_ENDPOINTS.UPCOMING.LIST}?limit=${limit}&page=${page}`);
    },
    getNextPageParam: lastPage => (lastPage.has_more ? lastPage.page + 1 : undefined),
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

export function useDashboardScrutinySummary() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.scrutinySummary(),
    queryFn: () => fetcher<DashboardScrutinySummaryResponse>(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
  });
}
