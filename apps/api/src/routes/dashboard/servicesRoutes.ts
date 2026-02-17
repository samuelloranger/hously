import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { buildNetdataDisabledSummary, fetchNetdataSummary, fetchScrutinySummary } from './shared';
import { dashboardQbittorrentRoutes } from './qbittorrentRoutes';
import { createJsonSseResponse } from './shared/sse';

export const dashboardServiceRoutes = new Elysia()
  .use(auth)
  .use(dashboardQbittorrentRoutes)
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
