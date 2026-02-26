import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardRedditResponse } from '../../types';

export function useDashboardReddit() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.reddit(),
    queryFn: () => fetcher<DashboardRedditResponse>(DASHBOARD_ENDPOINTS.REDDIT.POSTS),
  });
}

export function useDashboardRedditInfinite() {
  const fetcher = useFetcher();

  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.redditInfinite(),
    initialPageParam: '' as string,
    queryFn: ({ pageParam }) => {
      const url = pageParam
        ? `${DASHBOARD_ENDPOINTS.REDDIT.POSTS}?after=${encodeURIComponent(pageParam)}`
        : DASHBOARD_ENDPOINTS.REDDIT.POSTS;
      return fetcher<DashboardRedditResponse>(url);
    },
    getNextPageParam: (lastPage) => lastPage.after ?? undefined,
  });
}
