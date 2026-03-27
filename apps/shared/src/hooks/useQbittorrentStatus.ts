import { useQuery } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { QBITTORRENT_ENDPOINTS } from '../endpoints';
import type { DashboardQbittorrentStatusResponse } from '../types';

/** Global qBittorrent status (connection, summary speeds, counts). Same data as the dashboard card. */
export function useQbittorrentStatus() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.qbittorrent.status(),
    queryFn: () => fetcher<DashboardQbittorrentStatusResponse>(QBITTORRENT_ENDPOINTS.STATUS),
  });
}
