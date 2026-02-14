import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { dashboardApi } from '../api';

export function useDashboardQbittorrentStatus() {
  return useQuery({
    queryKey: queryKeys.dashboard.qbittorrentStatus(),
    queryFn: dashboardApi.getDashboardQbittorrentStatus,
    refetchInterval: 15000,
  });
}
