import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { dashboardApi } from '../api';

export function useDashboardJellyfinLatest(limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.dashboard.jellyfinLatest(),
    queryFn: () => dashboardApi.getDashboardJellyfinLatest(limit),
  });
}
