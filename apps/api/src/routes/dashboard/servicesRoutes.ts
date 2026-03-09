import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { fetchAdguardSummary } from '../../utils/dashboard/adguard';
import { buildNetdataDisabledSummary, fetchNetdataSummary } from '../../utils/dashboard/netdata';
import { fetchScrutinySummary } from '../../utils/dashboard/scrutiny';
import { fetchHackerNewsStories, HN_CACHE_TTL_SECONDS } from '../../utils/dashboard/hackernews';
import type { DashboardHackerNewsResponse } from '../../utils/dashboard/hackernews';
import { fetchRedditPosts, REDDIT_CACHE_TTL_SECONDS } from '../../utils/dashboard/reddit';
import type { DashboardRedditResponse } from '../../utils/dashboard/reddit';
import { dashboardQbittorrentRoutes } from './qbittorrentRoutes';
import { createJsonSseResponse } from '../../utils/sse';
import { prisma } from '../../db';
import { getJsonCache, setJsonCache } from '../../services/cache';
import { normalizeTrackerConfig } from '../../utils/plugins/normalizers';
import type { CachedTrackerStats } from '../../utils/dashboard/trackers';
import { cacheKey, parseCachedTrackerStats } from '../../utils/dashboard/trackers';
import type { TrackerType } from '../../utils/plugins/types';
import { serverError, unauthorized } from '../../utils/errors';

const trackerLabel = (type: TrackerType): string => {
  return {
    c411: 'C411',
    torr9: 'Torr9',
    'la-cale': 'La Cale',
  }[type];
};

async function getTrackerStatsHandler(type: TrackerType) {
  // Check Redis first. Stats are cached for 24 h, so if we have a cache hit the
  // plugin is enabled by definition — no DB query needed on every dashboard load.
  const cached = await getJsonCache<CachedTrackerStats>(cacheKey(type));
  const parsed = parseCachedTrackerStats(cached);
  if (parsed) {
    return { enabled: true, connected: true, ...parsed };
  }

  // Cache miss — fall back to DB to determine plugin state.
  const plugin = await prisma.plugin.findFirst({ where: { type } });
  const enabled = Boolean(plugin?.enabled);

  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      updated_at: null,
      uploaded_go: null,
      downloaded_go: null,
      ratio: null,
    };
  }

  const config = normalizeTrackerConfig(type, plugin?.config);
  if (!config) {
    return {
      enabled: true,
      connected: false,
      updated_at: null,
      uploaded_go: null,
      downloaded_go: null,
      ratio: null,
      error: `${trackerLabel(type)} plugin is not configured`,
    };
  }

  return {
    enabled: true,
    connected: false,
    updated_at: null,
    uploaded_go: null,
    downloaded_go: null,
    ratio: null,
    error: `${trackerLabel(type)} stats have not been fetched yet`,
  };
}

const TRACKER_TYPES: TrackerType[] = ['c411', 'torr9', 'la-cale'];

async function getAllTrackerStatsHandler() {
  const results = await Promise.all(
    TRACKER_TYPES.map(async type => {
      try {
        return [type, await getTrackerStatsHandler(type)] as const;
      } catch (error) {
        console.error(`Error fetching ${trackerLabel(type)} stats:`, error);
        return [
          type,
          {
            enabled: false,
            connected: false,
            updated_at: null,
            uploaded_go: null,
            downloaded_go: null,
            ratio: null,
            error: `Failed to get ${trackerLabel(type)} stats`,
          },
        ] as const;
      }
    })
  );

  return Object.fromEntries(results);
}

export const dashboardServiceRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .use(dashboardQbittorrentRoutes)
  .get('/trackers/stats', async ({ user, set }) => {
    try {
      return await getAllTrackerStatsHandler();
    } catch (error) {
      console.error('Error fetching trackers stats:', error);
      return serverError(set, 'Failed to get trackers stats');
    }
  })
  .get('/c411/stats', async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler('c411');
    } catch (error) {
      console.error('Error fetching C411 stats:', error);
      return serverError(set, 'Failed to get C411 stats');
    }
  })
  .get('/torr9/stats', async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler('torr9');
    } catch (error) {
      console.error('Error fetching Torr9 stats:', error);
      return serverError(set, 'Failed to get Torr9 stats');
    }
  })
  .get('/la-cale/stats', async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler('la-cale');
    } catch (error) {
      console.error('Error fetching La Cale stats:', error);
      return serverError(set, 'Failed to get La Cale stats');
    }
  })
  .get('/scrutiny/summary', async ({ user, set }) => {
    try {
      return await fetchScrutinySummary();
    } catch (error) {
      console.error('Error fetching Scrutiny summary:', error);
      return serverError(set, 'Failed to get Scrutiny summary');
    }
  })
  .get('/netdata/summary', async ({ user, set }) => {
    try {
      return await fetchNetdataSummary();
    } catch (error) {
      console.error('Error fetching Netdata summary:', error);
      return serverError(set, 'Failed to get Netdata summary');
    }
  })
  .get('/netdata/stream', async ({ user, set, request }) => {
    return createJsonSseResponse({
      request,
      poll: fetchNetdataSummary,
      intervalMs: 2000,
      retryMs: 5000,
      onError: () => ({
        ...buildNetdataDisabledSummary('Failed to refresh Netdata summary'),
        enabled: true,
        connected: false,
      }),
      logLabel: 'Netdata stream',
    });
  })
  .get('/adguard/summary', async ({ user, set }) => {
    try {
      return await fetchAdguardSummary();
    } catch (error) {
      console.error('Error fetching AdGuard Home summary:', error);
      return serverError(set, 'Failed to get AdGuard Home summary');
    }
  })
  .get('/hackernews', async ({ user, set }) => {
    try {
      const cached = await getJsonCache<DashboardHackerNewsResponse>('dashboard:hackernews');
      if (cached) {
        return cached;
      }

      const result = await fetchHackerNewsStories();
      if (result.enabled && result.stories.length > 0) {
        await setJsonCache('dashboard:hackernews', result, HN_CACHE_TTL_SECONDS);
      }
      return result;
    } catch (error) {
      console.error('Error fetching Hacker News stories:', error);
      return serverError(set, 'Failed to get Hacker News stories');
    }
  })
  .get('/reddit', async ({ user, set, query }) => {
    try {
      const afterCursor = (query as Record<string, string | undefined>).after;

      // Only cache the first page (no cursor)
      if (!afterCursor) {
        const cached = await getJsonCache<DashboardRedditResponse>('dashboard:reddit');
        if (cached) {
          return cached;
        }
      }

      const result = await fetchRedditPosts(afterCursor || undefined);

      if (!afterCursor && result.enabled && result.posts.length > 0) {
        await setJsonCache('dashboard:reddit', result, REDDIT_CACHE_TTL_SECONDS);
      }
      return result;
    } catch (error) {
      console.error('Error fetching Reddit posts:', error);
      return serverError(set, 'Failed to get Reddit posts');
    }
  });
