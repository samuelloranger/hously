import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { dashboardApi } from '../features/dashboard/api';
import { shoppingApi } from '../features/shopping/api';
import { choresApi } from '../features/chores/api';

/**
 * Query definitions for each route
 * Returns array of {queryKey, queryFn} objects
 */
const routeQueryDefinitions = {
  '/': () => [
    {
      queryKey: queryKeys.dashboard.stats(),
      queryFn: dashboardApi.getDashboardStats,
    },
    {
      queryKey: queryKeys.dashboard.activities(),
      queryFn: dashboardApi.getDashboardActivities,
    },
    {
      queryKey: queryKeys.dashboard.jellyfinLatest(),
      queryFn: () => dashboardApi.getDashboardJellyfinLatest(10),
    },
    {
      queryKey: queryKeys.dashboard.upcoming(),
      queryFn: () => dashboardApi.getDashboardUpcoming(8),
    },
    { queryKey: queryKeys.chores.list(), queryFn: choresApi.getChores },
  ],

  '/shopping': () => [
    {
      queryKey: queryKeys.shopping.items(),
      queryFn: shoppingApi.getShoppingItems,
    },
  ],

  '/chores': () => [{ queryKey: queryKeys.chores.list(), queryFn: choresApi.getChores }],

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
