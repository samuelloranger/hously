import { useMutation, useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type {
  DashboardQbittorrentStatusResponse,
  DashboardQbittorrentTorrentsResponse,
  DashboardQbittorrentCategoriesResponse,
  DashboardQbittorrentTagsResponse,
  DashboardQbittorrentTorrentPropertiesResponse,
  DashboardQbittorrentTorrentTrackersResponse,
  DashboardQbittorrentAddTorrentResponse,
  DashboardQbittorrentTorrentFilesResponse,
  DashboardQbittorrentTorrentPeersResponse,
  DashboardQbittorrentMutationResponse,
} from '../../types';

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
        `${DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS}${suffix ? `?${suffix}` : ''}`
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useDashboardQbittorrentCategories() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentCategories(),
    queryFn: () => fetcher<DashboardQbittorrentCategoriesResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.CATEGORIES),
  });
}

export function useDashboardQbittorrentTags() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTags(),
    queryFn: () => fetcher<DashboardQbittorrentTagsResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.TAGS),
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

export function useQbittorrentTorrentFiles(hash: string | null, refetchInterval?: number | false) {
  const fetcher = useFetcher();
  const safeHash = hash?.trim() ?? '';

  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentTorrentFiles(safeHash),
    queryFn: () => fetcher<DashboardQbittorrentTorrentFilesResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.FILES(safeHash)),
    enabled: Boolean(safeHash),
    refetchInterval,
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
    mutationFn: (torrents: File | File[]) => {
      const formData = new FormData();
      const files = Array.isArray(torrents) ? torrents : [torrents];
      files.forEach(file => {
        formData.append('torrents', file as any);
      });
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

export function useReannounceQbittorrentTorrent(hash: string) {
  const fetcher = useFetcher();
  const safeHash = hash.trim();

  return useMutation({
    mutationFn: () =>
      fetcher<DashboardQbittorrentMutationResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.REANNOUNCE(safeHash), {
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
