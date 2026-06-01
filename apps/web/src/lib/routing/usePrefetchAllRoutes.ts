import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
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
 * Warm the lazy JS chunk for every nav route — fire and forget, deferred to
 * browser idle. We intentionally do NOT prefetch route DATA here: heavy
 * payloads (e.g. /api/library ~900 KB) would bloat the dashboard's initial
 * load. Route data is fetched on navigation, and warmed on hover/touch via
 * usePrefetchRoute (intent-based), which keeps navigation feeling instant.
 */
export function usePrefetchAllRoutes() {
  const router = useRouter();

  return useCallback(() => {
    runWhenIdle(() => {
      for (const path of ALL_NAV_PATHS) {
        void router.preloadRoute({ to: path });
      }
    });
  }, [router]);
}
