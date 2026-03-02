import { useQuery } from '@tanstack/react-query';
import { useFetcher } from '../context';
import { queryKeys } from '../../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../../endpoints';
import type { DashboardHackerNewsResponse } from '../../types';

export function useDashboardHackerNews() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.hackerNews(),
    queryFn: () => fetcher<DashboardHackerNewsResponse>(DASHBOARD_ENDPOINTS.HACKERNEWS.STORIES),
  });
}
