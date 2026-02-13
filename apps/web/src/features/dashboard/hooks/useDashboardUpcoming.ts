import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { dashboardApi } from '../api';

export function useDashboardUpcoming(limit: number = 8) {
  return useQuery({
    queryKey: queryKeys.dashboard.upcoming(),
    queryFn: () => dashboardApi.getDashboardUpcoming(limit),
  });
}
