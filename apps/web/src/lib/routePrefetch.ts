import type { QueryClient } from '@tanstack/react-query';
import { CHORES_ENDPOINTS, DASHBOARD_ENDPOINTS, queryKeys, SHOPPING_ENDPOINTS } from '@hously/shared';
import { webFetcher } from './fetcher';

/**
 * Query definitions for each route
 * Returns array of {queryKey, queryFn} objects
 */
const routeQueryDefinitions = {
  '/': () => [
    {
      queryKey: queryKeys.dashboard.stats(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.STATS),
    },
    {
      queryKey: queryKeys.dashboard.activities(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.ACTIVITIES),
    },
    {
      queryKey: queryKeys.dashboard.jellyfinLatest(),
      queryFn: () => webFetcher(`${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=10`),
    },
    {
      queryKey: queryKeys.dashboard.upcoming(),
      queryFn: () => webFetcher(`${DASHBOARD_ENDPOINTS.UPCOMING.LIST}?limit=8`),
    },
    {
      queryKey: queryKeys.dashboard.qbittorrentStatus(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.STATUS),
    },
    {
      queryKey: queryKeys.dashboard.scrutinySummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
    },
    { queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) },
  ],

  '/shopping': () => [
    {
      queryKey: queryKeys.shopping.items(),
      queryFn: () => webFetcher(SHOPPING_ENDPOINTS.LIST),
    },
  ],

  '/chores': () => [{ queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) }],

  // Note: /notifications is intentionally not prefetched because it uses
  // useInfiniteQuery which has a different data structure (pages array).
  // Prefetching with a regular query would cause cache structure mismatches.
} as const;

/**
 * Generic helper to prefetch queries for a route using ensureQueryData
 */
async function prefetchQueriesForRoute(
  queryClient: QueryClient,
  route: keyof typeof routeQueryDefinitions
): Promise<void> {
  const queryDef = routeQueryDefinitions[route];
  if (!queryDef) return;

  const queries = queryDef();
  await Promise.all(queries.map(q => queryClient.ensureQueryData(q as any)));
}

/**
 * Prefetch data for a route
 * Used by router loaders - uses ensureQueryData (waits for data)
 */
export async function prefetchRouteData(queryClient: QueryClient, route: string): Promise<void> {
  await prefetchQueriesForRoute(queryClient, route as keyof typeof routeQueryDefinitions);
}

/**
 * Optimistically prefetch data for a route (fire and forget)
 * Used by hover prefetching - uses prefetchQuery (non-blocking)
 */
export function prefetchRouteDataOptimistic(queryClient: QueryClient, route: string): void {
  // Normalize route (handle /dashboard alias)
  const normalizedRoute = route === '/dashboard' ? '/' : route;

  const queryDef = routeQueryDefinitions[normalizedRoute as keyof typeof routeQueryDefinitions];
  if (!queryDef) return;

  // Use non-blocking prefetch for hover/touch
  const queries = queryDef();
  queries.forEach(q => {
    queryClient.prefetchQuery(q as any);
  });
}
