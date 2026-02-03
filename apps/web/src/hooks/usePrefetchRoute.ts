import { useCallback } from "react";
import { getQueryClient } from "../lib/queryClient";
import { prefetchRouteDataOptimistic } from "../lib/routePrefetch";

/**
 * Hook to prefetch route data on link hover for instant navigation
 * This eliminates loading states when navigating between pages
 */
export function usePrefetchRoute() {
  const prefetch = useCallback((route: string) => {
    const queryClient = getQueryClient();
    if (!queryClient) return;

    // Use optimistic (non-blocking) prefetch for hover/touch
    prefetchRouteDataOptimistic(queryClient, route);
  }, []);

  return prefetch;
}
