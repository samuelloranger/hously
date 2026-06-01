import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { getQueryClient } from "@/lib/api/queryClient";
import { prefetchRouteDataOptimistic } from "@/lib/routing/prefetch";
import { navSections } from "@/lib/routing/navigation";

const ALL_NAV_PATHS = navSections.flatMap((s) => s.items.map((i) => i.path));

function runWhenIdle(fn: () => void): void {
  if (typeof window === "undefined") return;
  const ric = (window as typeof window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else setTimeout(fn, 1500);
}

/**
 * Prefetch all nav routes — fire and forget, but DEFERRED to browser idle so
 * it never competes with the current page's critical render/data. Warms both
 * the lazy JS chunk (router.preloadRoute) and the React Query cache
 * (prefetchRouteDataOptimistic) for every nav item.
 */
export function usePrefetchAllRoutes() {
  const router = useRouter();

  return useCallback(() => {
    runWhenIdle(() => {
      const queryClient = getQueryClient();
      for (const path of ALL_NAV_PATHS) {
        void router.preloadRoute({ to: path });
        if (queryClient) prefetchRouteDataOptimistic(queryClient, path);
      }
    });
  }, [router]);
}
