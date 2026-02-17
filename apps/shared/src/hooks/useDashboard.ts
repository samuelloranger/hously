import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../endpoints';
import type {
  DashboardStatsResponse,
  DashboardJellyfinLatestResponse,
  DashboardNetdataSummaryResponse,
  DashboardScrutinySummaryResponse,
  DashboardUpcomingResponse,
  DashboardQbittorrentStatusResponse,
  DashboardQbittorrentTorrentsResponse,
  DashboardQbittorrentTorrentPropertiesResponse,
  DashboardQbittorrentTorrentTrackersResponse,
  DashboardQbittorrentAddTorrentResponse,
  DashboardQbittorrentTorrentFilesResponse,
  DashboardQbittorrentTorrentPeersResponse,
  DashboardQbittorrentMutationResponse,
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

export function useDashboardQbittorrentTorrents(
  params?: {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  },
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();

  const search = new URLSearchParams();
  if (params?.filter) search.set('filter', params.filter);
  if (params?.category) search.set('category', params.category);
  if (params?.tag) search.set('tag', params.tag);
  if (params?.sort) search.set('sort', params.sort);
  if (typeof params?.reverse === 'boolean') search.set('reverse', params.reverse ? 'true' : 'false');
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') search.set('offset', String(params.offset));
  const suffix = search.toString();

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrents(params ?? {}),
    queryFn: () =>
      fetcher<DashboardQbittorrentTorrentsResponse>(
        suffix ? `${DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS}?${suffix}` : DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useQbittorrentTorrentProperties(hash: string | null) {
  const fetcher = useFetcher();
  const safeHash = hash?.trim() ?? '';

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrentProperties(safeHash),
    queryFn: () =>
      fetcher<DashboardQbittorrentTorrentPropertiesResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.PROPERTIES(safeHash)),
    enabled: Boolean(safeHash),
  });
}

export function useQbittorrentTorrentTrackers(hash: string | null) {
  const fetcher = useFetcher();
  const safeHash = hash?.trim() ?? '';

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrentTrackers(safeHash),
    queryFn: () =>
      fetcher<DashboardQbittorrentTorrentTrackersResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.TRACKERS(safeHash)),
    enabled: Boolean(safeHash),
  });
}

export function useQbittorrentTorrentFiles(hash: string | null) {
  const fetcher = useFetcher();
  const safeHash = hash?.trim() ?? '';

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrentFiles(safeHash),
    queryFn: () => fetcher<DashboardQbittorrentTorrentFilesResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.FILES(safeHash)),
    enabled: Boolean(safeHash),
  });
}

export function useQbittorrentTorrentPeers(hash: string | null, rid?: number) {
  const fetcher = useFetcher();
  const safeHash = hash?.trim() ?? '';

  const suffix = typeof rid === 'number' && Number.isFinite(rid) ? `?rid=${Math.max(0, Math.trunc(rid))}` : '';

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrentPeers(safeHash),
    queryFn: () =>
      fetcher<DashboardQbittorrentTorrentPeersResponse>(`${DASHBOARD_ENDPOINTS.QBITTORRENT.PEERS(safeHash)}${suffix}`),
    enabled: Boolean(safeHash),
  });
}

export function useAddQbittorrentMagnet() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: { magnet: string }) =>
      fetcher<DashboardQbittorrentAddTorrentResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.ADD_MAGNET, {
        method: 'POST',
        body: data,
      }),
  });
}

export function useAddQbittorrentTorrentFile() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (torrent: File) => {
      const formData = new FormData();
      formData.set('torrent', torrent);
      return fetcher<DashboardQbittorrentAddTorrentResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.ADD_FILE, {
        method: 'POST',
        body: formData,
      });
    },
  });
}

export function useRenameQbittorrentTorrent(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: (data: { name: string }) =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.RENAME(safeHash), {
        method: 'POST',
        body: data,
      }),
  });
}

export function useRenameQbittorrentTorrentFile(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: (data: { old_path: string; new_path: string }) =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.RENAME_FILE(safeHash), {
        method: 'POST',
        body: data,
      }),
  });
}

export function useSetQbittorrentTorrentCategory(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: (data: { category?: string }) =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.SET_CATEGORY(safeHash), {
        method: 'POST',
        body: data,
      }),
  });
}

export function useSetQbittorrentTorrentTags(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: (data: { tags: string[]; previous_tags?: string[] }) =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.SET_TAGS(safeHash), {
        method: 'POST',
        body: data,
      }),
  });
}

export function usePauseQbittorrentTorrent(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: () =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.PAUSE(safeHash), {
        method: 'POST',
        body: {},
      }),
  });
}

export function useResumeQbittorrentTorrent(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: () =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.RESUME(safeHash), {
        method: 'POST',
        body: {},
      }),
  });
}

export function useDeleteQbittorrentTorrent(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: (data: { delete_files?: boolean }) =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.DELETE(safeHash), {
        method: 'POST',
        body: data,
      }),
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
