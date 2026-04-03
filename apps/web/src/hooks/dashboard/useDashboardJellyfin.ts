import { useInfiniteQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared";
import type { DashboardJellyfinLatestResponse } from "@hously/shared";

export function useDashboardJellyfinLatestInfinite(limit: number = 10) {
  const fetcher = useFetcher();

  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.jellyfinLatestInfinite(limit),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const page =
        typeof pageParam === "number" && Number.isFinite(pageParam)
          ? pageParam
          : 1;
      return fetcher<DashboardJellyfinLatestResponse>(
        `${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${limit}&page=${page}`,
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.page + 1 : undefined,
  });
}
