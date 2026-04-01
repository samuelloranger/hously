import type { QueryClient } from '@tanstack/react-query';
import {
  ADMIN_ENDPOINTS,
  AUTH_ENDPOINTS,
  CALENDAR_ENDPOINTS,
  CHORES_ENDPOINTS,
  DASHBOARD_ENDPOINTS,
  QBITTORRENT_ENDPOINTS,
  QBITTORRENT_TORRENTS_PAGE_SIZE,
  EXTERNAL_NOTIFICATION_ENDPOINTS,
  MEAL_PLAN_ENDPOINTS,
  MEDIAS_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
  PLUGIN_ENDPOINTS,
  queryKeys,
  RECIPES_ENDPOINTS,
  SHOPPING_ENDPOINTS,
  HABIT_ENDPOINTS,
  type DashboardJellyfinLatestResponse,
  type HomeAssistantWidgetResponse,
  type UserResponse,
} from '@hously/shared';
import { webFetcher } from './fetcher';

/** Jellyfin shelf page size — must match `useDashboardJellyfinLatestInfinite` on the home page. */
const HOME_JELLYFIN_LIMIT = 10;

/** Local calendar date `YYYY-MM-DD`, aligned with `HabitsPanel` / `useHabits(today)`. */
function localIsoDateToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Eager cache fill for `/` (home): every TanStack Query used by the home UI.
 * Runs in the route loader before paint (SPA analogue of a server prefetch / “server action” bootstrap).
 */
export async function prefetchHomePageData(queryClient: QueryClient): Promise<void> {
  const today = localIsoDateToday();

  const standard = [
    {
      queryKey: queryKeys.auth.me,
      queryFn: async () => {
        const response = await webFetcher<UserResponse>(AUTH_ENDPOINTS.ME);
        return response.user;
      },
    },
    {
      queryKey: queryKeys.dashboard.stats(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.STATS),
    },
    { queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) },
    {
      queryKey: [...queryKeys.habits.list(), today] as const,
      queryFn: () => webFetcher(`${HABIT_ENDPOINTS.LIST}?date=${today}`),
    },
    {
      queryKey: queryKeys.weather.current(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.WEATHER),
    },
    {
      queryKey: queryKeys.dashboard.upcoming(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
    },
    {
      queryKey: queryKeys.qbittorrent.status(),
      queryFn: () => webFetcher(QBITTORRENT_ENDPOINTS.STATUS),
    },
    {
      queryKey: queryKeys.dashboard.qbittorrentPinnedTorrent(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.PINNED),
    },
    {
      queryKey: queryKeys.dashboard.scrutinySummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
    },
    {
      queryKey: queryKeys.dashboard.beszelSummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.BESZEL.SUMMARY),
    },
    {
      queryKey: queryKeys.dashboard.adguardSummary(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.ADGUARD.SUMMARY),
    },
    {
      queryKey: queryKeys.dashboard.trackersStats(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
    },
    {
      queryKey: queryKeys.dashboard.homeAssistantWidget(),
      queryFn: () => webFetcher<HomeAssistantWidgetResponse>(DASHBOARD_ENDPOINTS.HOME_ASSISTANT.WIDGET),
    },
  ];

  await Promise.allSettled([
    ...standard.map(q => queryClient.ensureQueryData(q as any)),
    queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.dashboard.jellyfinLatestInfinite(HOME_JELLYFIN_LIMIT),
      initialPageParam: 1,
      queryFn: ({ pageParam }) => {
        const page = typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 1;
        return webFetcher<DashboardJellyfinLatestResponse>(
          `${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${HOME_JELLYFIN_LIMIT}&page=${page}`
        );
      },
    }),
  ]);
}

/** Non-blocking home prefetch (e.g. nav hover). */
export function prefetchHomePageDataOptimistic(queryClient: QueryClient): void {
  const today = localIsoDateToday();

  void queryClient.prefetchQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const response = await webFetcher<UserResponse>(AUTH_ENDPOINTS.ME);
      return response.user;
    },
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.STATS),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.chores.list(),
    queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST),
  });
  void queryClient.prefetchQuery({
    queryKey: [...queryKeys.habits.list(), today] as const,
    queryFn: () => webFetcher(`${HABIT_ENDPOINTS.LIST}?date=${today}`),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.weather.current(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.WEATHER),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.upcoming(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.qbittorrent.status(),
    queryFn: () => webFetcher(QBITTORRENT_ENDPOINTS.STATUS),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.qbittorrentPinnedTorrent(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.QBITTORRENT.PINNED),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.scrutinySummary(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.beszelSummary(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.BESZEL.SUMMARY),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.adguardSummary(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.ADGUARD.SUMMARY),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.trackersStats(),
    queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.homeAssistantWidget(),
    queryFn: () => webFetcher<HomeAssistantWidgetResponse>(DASHBOARD_ENDPOINTS.HOME_ASSISTANT.WIDGET),
  });
  void queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.dashboard.jellyfinLatestInfinite(HOME_JELLYFIN_LIMIT),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 1;
      return webFetcher<DashboardJellyfinLatestResponse>(
        `${DASHBOARD_ENDPOINTS.JELLYFIN.LATEST}?limit=${HOME_JELLYFIN_LIMIT}&page=${page}`
      );
    },
  });
}

/**
 * Query definitions for each route
 * Returns array of {queryKey, queryFn} objects
 */
const routeQueryDefinitions = {
  '/shopping': () => [
    {
      queryKey: queryKeys.shopping.items(),
      queryFn: () => webFetcher(SHOPPING_ENDPOINTS.LIST),
    },
  ],

  '/chores': () => [{ queryKey: queryKeys.chores.list(), queryFn: () => webFetcher(CHORES_ENDPOINTS.LIST) }],

  '/habits': () => [{ queryKey: queryKeys.habits.list(), queryFn: () => webFetcher(HABIT_ENDPOINTS.LIST) }],

  '/calendar': () => [
    {
      queryKey: queryKeys.calendar.events(),
      queryFn: () => webFetcher(CALENDAR_ENDPOINTS.EVENTS),
    },
    {
      queryKey: queryKeys.customEvents.list(),
      queryFn: () => webFetcher(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.LIST),
    },
    {
      queryKey: queryKeys.dashboard.upcoming(),
      queryFn: () => webFetcher(DASHBOARD_ENDPOINTS.UPCOMING.LIST),
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
      queryKey: queryKeys.qbittorrent.status(),
      queryFn: () => webFetcher(QBITTORRENT_ENDPOINTS.STATUS),
    },
    {
      queryKey: queryKeys.dashboard.qbittorrentTorrents({
        offset: 0,
        limit: QBITTORRENT_TORRENTS_PAGE_SIZE,
        sort: 'added_on',
        reverse: true,
      }),
      queryFn: () =>
        webFetcher(
          `${DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS}?sort=added_on&reverse=true&limit=${QBITTORRENT_TORRENTS_PAGE_SIZE}&offset=0`
        ),
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

  '/activity': (params: { service?: string; type?: string }) => [
    {
      queryKey: queryKeys.dashboard.activityFeed({ limit: 25, service: params.service, type: params.type }),
      queryFn: () => {
        const search = new URLSearchParams({ limit: '25' });
        if (params.service) search.set('service', params.service);
        if (params.type) search.set('type', params.type);
        return webFetcher(`${DASHBOARD_ENDPOINTS.ACTIVITIES_FEED}?${search.toString()}`);
      },
    },
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
      queries.push({ queryKey: queryKeys.plugins.beszel(), queryFn: () => webFetcher(PLUGIN_ENDPOINTS.BESZEL) });
    }

    if (tab === 'jobs') {
      queries.push({
        queryKey: queryKeys.admin.scheduledJobs(),
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
  await Promise.allSettled(queries.map((q: any) => queryClient.ensureQueryData(q)));
}

/**
 * Prefetch data for a route
 * Used by router loaders - uses ensureQueryData (waits for data)
 */
export async function prefetchRouteData(queryClient: QueryClient, routeId: string, params: any = {}): Promise<void> {
  const normalizedRouteId = routeId === '/dashboard' ? '/' : routeId;
  if (normalizedRouteId === '/') {
    await prefetchHomePageData(queryClient);
    return;
  }
  await prefetchQueriesForRoute(queryClient, routeId, params);
}

/**
 * Optimistically prefetch data for a route (fire and forget)
 * Used by hover prefetching - uses prefetchQuery (non-blocking)
 */
export function prefetchRouteDataOptimistic(queryClient: QueryClient, routeId: string, params: any = {}): void {
  const normalizedRouteId = routeId === '/dashboard' ? '/' : routeId;
  if (normalizedRouteId === '/') {
    prefetchHomePageDataOptimistic(queryClient);
    return;
  }

  const queryDef = (routeQueryDefinitions as any)[normalizedRouteId];
  if (!queryDef) return;

  const queries = queryDef(params);
  queries.forEach((q: any) => {
    queryClient.prefetchQuery(q);
  });
}
