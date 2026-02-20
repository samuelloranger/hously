import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardJellyfinLatestResponse } from '../../types';

export function useDashboardJellyfinLatest(limit: number = 10, page: number = 1) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.jellyfinLatest(limit, page),
    queryFn: () =>
      fetcher<DashboardJellyfinLatestResponse>(`${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${limit}&page=${page}`),
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
