import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardGiteaBuildResponse } from '../../types';

export function useDashboardGiteaBuilds() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.giteaBuilds(),
    queryFn: () => fetcher<DashboardGiteaBuildResponse>(DASHBOARD_ENDPOINTS.GITEA.BUILDS),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
