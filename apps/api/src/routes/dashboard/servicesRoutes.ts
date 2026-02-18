import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { buildNetdataDisabledSummary, fetchNetdataSummary } from '../../utils/dashboard/netdata';
import { fetchScrutinySummary } from '../../utils/dashboard/scrutiny';
import { dashboardQbittorrentRoutes } from './qbittorrentRoutes';
import { createJsonSseResponse } from '../../utils/sse';
import { prisma } from '../../db';
import { normalizeYggConfig } from '../../utils/plugins/normalizers';
import { getJsonCache } from '../../services/cache';
import type { CachedYggStats } from '../../utils/dashboard/ygg';
import { parseCachedYggStats } from '../../utils/dashboard/ygg';

export const dashboardServiceRoutes = new Elysia()
  .use(auth)
  .use(dashboardQbittorrentRoutes)
  .get('/ygg/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const plugin = await prisma.plugin.findFirst({ where: { type: 'ygg' } });
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

      const config = normalizeYggConfig(plugin?.config);
      if (!config) {
        return {
          enabled: true,
          connected: false,
          updated_at: null,
          uploaded_go: null,
          downloaded_go: null,
          ratio: null,
          error: 'YGG plugin is not configured',
        };
      }

      const cached = await getJsonCache<CachedYggStats>('yggTopPanelStats');
      const parsed = parseCachedYggStats(cached);

      if (!parsed) {
        return {
          enabled: true,
          connected: false,
          updated_at: null,
          uploaded_go: null,
          downloaded_go: null,
          ratio: null,
          error: 'YGG stats have not been fetched yet',
        };
      }

      return {
        enabled: true,
        connected: true,
        ...parsed,
      };
    } catch (error) {
      console.error('Error fetching YGG stats:', error);
      set.status = 500;
      return { error: 'Failed to get YGG stats' };
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
