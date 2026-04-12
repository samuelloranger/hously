import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { getQueryClient } from "@/lib/api/queryClient";
import { prefetchRouteDataOptimistic } from "@/lib/routing/prefetch";
import { navSections } from "@/lib/routing/navigation";

const ALL_NAV_PATHS = navSections.flatMap((s) => s.items.map((i) => i.path));

/**
 * Prefetch all nav routes at once — fire and forget.
 * Warms both the JS bundle (router.preloadRoute) and the React Query
 * cache (prefetchRouteDataOptimistic) for every nav item.
 * Use on sidebar mount and mobile menu open for instant navigation everywhere.
 */
export function usePrefetchAllRoutes() {
  const router = useRouter();

  return useCallback(() => {
    const queryClient = getQueryClient();

    for (const path of ALL_NAV_PATHS) {
      // Preload the lazy JS chunk for this route
      void router.preloadRoute({ to: path });

      // Warm the React Query cache with API data
      if (queryClient) {
        prefetchRouteDataOptimistic(queryClient, path);
      }
    }
  }, [router]);
}
