import type { QueryClient } from '@tanstack/react-query';
import {
  ADMIN_ENDPOINTS,
  CALENDAR_ENDPOINTS,
  CHORES_ENDPOINTS,
  DASHBOARD_ENDPOINTS,
  EXTERNAL_NOTIFICATION_ENDPOINTS,
  MEAL_PLAN_ENDPOINTS,
  MEDIAS_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
  PLUGIN_ENDPOINTS,
  queryKeys,
  RECIPES_ENDPOINTS,
  SHOPPING_ENDPOINTS,
} from '@hously/shared';
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
      queryKey: queryKeys.dashboard.qbittorrentStatus(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.STATUS),
    },
    {
      queryKey: queryKeys.dashboard.scrutinySummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
    },
    {
      queryKey: queryKeys.dashboard.netdataSummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.NETDATA.SUMMARY),
    },
    { queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) },
    {
      queryKey: queryKeys.weather.current(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.WEATHER),
    },
    {
      queryKey: queryKeys.dashboard.upcoming(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
    },
    {
      queryKey: queryKeys.plugins.radarr(),
      queryFn: () => webFetcher(PLUGIN_ENDPOINTS.RADARR),
    },
    {
      queryKey: queryKeys.plugins.sonarr(),
      queryFn: () => webFetcher(PLUGIN_ENDPOINTS.SONARR),
    },
    {
      queryKey: queryKeys.plugins.tmdb(),
      queryFn: () => webFetcher(PLUGIN_ENDPOINTS.TMDB),
    },
    {
      queryKey: queryKeys.dashboard.trackerStats('ygg'),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.YGG.STATS),
    },
    {
      queryKey: queryKeys.dashboard.trackerStats('c411'),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.C411.STATS),
    },
    {
      queryKey: queryKeys.dashboard.trackerStats('torr9'),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.TORR9.STATS),
    },
    {
      queryKey: queryKeys.dashboard.trackerStats('g3mini'),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.G3MINI.STATS),
    },
    {
      queryKey: queryKeys.dashboard.trackerStats('la-cale'),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.LA_CALE.STATS),
    },
  ],

  '/shopping': () => [
    {
      queryKey: queryKeys.shopping.items(),
      queryFn: () => webFetcher(SHOPPING_ENDPOINTS.LIST),
    },
  ],

  '/chores': () => [{ queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) }],

  '/calendar': () => [
    {
      queryKey: queryKeys.calendar.events(),
      queryFn: () => webFetcher(CALENDAR_ENDPOINTS.EVENTS),
    },
    {
      queryKey: queryKeys.customEvents.list(),
      queryFn: () => webFetcher(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.LIST),
    },
  ],

  '/kitchen': () => [
    {
      queryKey: queryKeys.recipes.lists(),
      queryFn: () => webFetcher(RECIPES_ENDPOINTS.LIST),
    },
    {
      queryKey: queryKeys.mealPlans.lists(),
      queryFn: () => webFetcher(MEAL_PLAN_ENDPOINTS.LIST),
    },
  ],

  '/kitchen/$recipeId': (params: { recipeId: string }) => [
    {
      queryKey: queryKeys.recipes.detail(Number(params.recipeId)),
      queryFn: () => webFetcher(RECIPES_ENDPOINTS.DETAIL(Number(params.recipeId))),
    },
  ],

  '/torrents': () => [
    {
      queryKey: queryKeys.dashboard.qbittorrentTorrents({}),
      queryFn: () => webFetcher(`${DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS}?sort=added_on&reverse=true&limit=250`),
    },
  ],

  '/torrents/$hash': (params: { hash: string }) => [
    {
      queryKey: queryKeys.dashboard.qbittorrentTorrentProperties(params.hash),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.PROPERTIES(params.hash)),
    },
    {
      queryKey: queryKeys.dashboard.qbittorrentTorrentFiles(params.hash),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.FILES(params.hash)),
    },
  ],

  '/explore': () => [
    {
      queryKey: queryKeys.medias.explore(),
      queryFn: () => webFetcher(`${MEDIAS_ENDPOINTS.EXPLORE}?language=en`),
    },
  ],

  '/library': () => [
    {
      queryKey: queryKeys.medias.list(),
      queryFn: () => webFetcher(MEDIAS_ENDPOINTS.LIST),
    },
  ],

  '/notifications': () => [
    {
      queryKey: queryKeys.notifications.unreadCount(),
      queryFn: () => webFetcher(NOTIFICATION_ENDPOINTS.UNREAD_COUNT),
    },
    // Note: notifications list uses useInfiniteQuery which is harder to prefetch
    // with ensureQueryData due to structure mismatch if not careful.
  ],

  '/settings': (params: { tab?: string }) => {
    const tab = params.tab || 'profile';
    const queries: any[] = [];

    // Always prefetch user profile for settings
    queries.push({
      queryKey: queryKeys.auth.me,
      queryFn: () => webFetcher('/api/auth/me'),
    });

    if (tab === 'notifications') {
      queries.push({
        queryKey: queryKeys.notifications.devices(),
        queryFn: () => webFetcher(NOTIFICATION_ENDPOINTS.DEVICES),
      });
    }

    if (tab === 'users') {
      queries.push({
        queryKey: queryKeys.admin.users(),
        queryFn: () => webFetcher(ADMIN_ENDPOINTS.USERS),
      });
    }

    if (tab === 'external-notifications') {
      queries.push({
        queryKey: queryKeys.externalNotifications.services(),
        queryFn: () => webFetcher(EXTERNAL_NOTIFICATION_ENDPOINTS.SERVICES),
      });
      queries.push({
        queryKey: queryKeys.externalNotifications.logs(),
        queryFn: () => webFetcher(EXTERNAL_NOTIFICATION_ENDPOINTS.LOGS),
      });
    }

    if (tab === 'plugins') {
      queries.push({ queryKey: queryKeys.plugins.weather(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.WEATHER) });
      queries.push({ queryKey: queryKeys.plugins.tmdb(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.TMDB) });
      queries.push({ queryKey: queryKeys.plugins.jellyfin(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.JELLYFIN) });
      queries.push({ queryKey: queryKeys.plugins.radarr(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.RADARR) });
      queries.push({ queryKey: queryKeys.plugins.sonarr(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.SONARR) });
      queries.push({
        queryKey: queryKeys.plugins.qbittorrent(),
        queryFn: () => webFetcher(PLUGIN_ENDPOINTS.QBITTORRENT),
      });
      queries.push({ queryKey: queryKeys.plugins.scrutiny(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.SCRUTINY) });
      queries.push({ queryKey: queryKeys.plugins.netdata(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.NETDATA) });
      queries.push({ queryKey: queryKeys.plugins.tracker('ygg'), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.YGG) });
    }

    if (tab === 'jobs') {
      queries.push({
        queryKey: ['admin', 'scheduled-jobs'],
        queryFn: () => webFetcher(ADMIN_ENDPOINTS.SCHEDULED_JOBS),
      });
    }

    return queries;
  },
} as const;

/**
 * Generic helper to prefetch queries for a route using ensureQueryData
 */
async function prefetchQueriesForRoute(queryClient: QueryClient, routeId: string, params: any = {}): Promise<void> {
  const queryDef = (routeQueryDefinitions as any)[routeId];
  if (!queryDef) return;

  const queries = queryDef(params);
  await Promise.all(queries.map((q: any) => queryClient.ensureQueryData(q)));
}

/**
 * Prefetch data for a route
 * Used by router loaders - uses ensureQueryData (waits for data)
 */
export async function prefetchRouteData(queryClient: QueryClient, routeId: string, params: any = {}): Promise<void> {
  await prefetchQueriesForRoute(queryClient, routeId, params);
}

/**
 * Optimistically prefetch data for a route (fire and forget)
 * Used by hover prefetching - uses prefetchQuery (non-blocking)
 */
export function prefetchRouteDataOptimistic(queryClient: QueryClient, routeId: string, params: any = {}): void {
  // Normalize routeId
  const normalizedRouteId = routeId === '/dashboard' ? '/' : routeId;

  const queryDef = (routeQueryDefinitions as any)[normalizedRouteId];
  if (!queryDef) return;

  // Use non-blocking prefetch for hover/touch
  const queries = queryDef(params);
  queries.forEach((q: any) => {
    queryClient.prefetchQuery(q);
  });
}
