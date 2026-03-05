import { Elysia } from 'elysia';
import { createJsonSseResponse } from '../../utils/sse';
import {
  fetchGiteaBuildStatus,
  getCachedGiteaBuildStatus,
  isBuildActive,
} from '../../utils/dashboard/gitea';

export const dashboardGiteaRoutes = new Elysia()
  .get('/gitea/builds', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await fetchGiteaBuildStatus(true);
    } catch (error) {
      console.error('Error fetching Gitea build status:', error);
      set.status = 500;
      return { error: 'Failed to get Gitea build status' };
    }
  })

  .get('/gitea/builds/stream', async ({ user, set, request }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    return createJsonSseResponse({
      request,
      poll: async () => {
        // Only actively poll Gitea when a build is in progress
        if (isBuildActive()) {
          return fetchGiteaBuildStatus(true);
        }

        // Otherwise return cached data (no API call)
        const cached = getCachedGiteaBuildStatus();
        if (cached) return cached;

        // First connection or no cache — do one fetch
        return fetchGiteaBuildStatus(true);
      },
      intervalMs: (snapshot) => {
        if (isBuildActive() || snapshot.building) {
          return 3000;
        }
        // Idle: very slow heartbeat just to keep connection alive
        return 30000;
      },
      retryMs: 5000,
      onError: (error) => ({
        enabled: true,
        connected: false,
        building: false,
        run: null,
        jobs: null,
        logs: null,
        error: error instanceof Error ? error.message : 'Failed to refresh Gitea build status',
      }),
      logLabel: 'Gitea builds stream',
    });
  });
