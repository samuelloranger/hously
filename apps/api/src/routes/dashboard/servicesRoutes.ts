import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { buildNetdataDisabledSummary, fetchNetdataSummary } from '../../utils/dashboard/netdata';
import { fetchScrutinySummary } from '../../utils/dashboard/scrutiny';
import { dashboardQbittorrentRoutes } from './qbittorrentRoutes';
import { createJsonSseResponse } from '../../utils/sse';
import { prisma } from '../../db';
import { getJsonCache } from '../../services/cache';
import { normalizeTrackerConfig } from '../../utils/plugins/normalizers';
import type { CachedTrackerStats } from '../../utils/dashboard/trackers';
import { cacheKey, parseCachedTrackerStats } from '../../utils/dashboard/trackers';
import type { TrackerType } from '../../utils/plugins/types';

const trackerLabel = (type: TrackerType): string => type.toUpperCase();

async function getTrackerStatsHandler(type: TrackerType) {
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

  const cached = await getJsonCache<CachedTrackerStats>(cacheKey(type));
  const parsed = parseCachedTrackerStats(cached);
  if (!parsed) {
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

  return {
    enabled: true,
    connected: true,
    ...parsed,
  };
}

export const dashboardServiceRoutes = new Elysia()
  .use(auth)
  .use(dashboardQbittorrentRoutes)
  .get('/ygg/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getTrackerStatsHandler('ygg');
    } catch (error) {
      console.error('Error fetching YGG stats:', error);
      set.status = 500;
      return { error: 'Failed to get YGG stats' };
    }
  })
  .get('/c411/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getTrackerStatsHandler('c411');
    } catch (error) {
      console.error('Error fetching C411 stats:', error);
      set.status = 500;
      return { error: 'Failed to get C411 stats' };
    }
  })
  .get('/torr9/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getTrackerStatsHandler('torr9');
    } catch (error) {
      console.error('Error fetching Torr9 stats:', error);
      set.status = 500;
      return { error: 'Failed to get Torr9 stats' };
    }
  })
  .get('/g3mini/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getTrackerStatsHandler('g3mini');
    } catch (error) {
      console.error('Error fetching G3mini stats:', error);
      set.status = 500;
      return { error: 'Failed to get G3mini stats' };
    }
  })
  .get('/scrutiny/summary', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await fetchScrutinySummary();
    } catch (error) {
      console.error('Error fetching Scrutiny summary:', error);
      set.status = 500;
      return { error: 'Failed to get Scrutiny summary' };
    }
  })
  .get('/netdata/summary', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await fetchNetdataSummary();
    } catch (error) {
      console.error('Error fetching Netdata summary:', error);
      set.status = 500;
      return { error: 'Failed to get Netdata summary' };
    }
  })
  .get('/netdata/stream', async ({ user, set, request }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

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
  });
