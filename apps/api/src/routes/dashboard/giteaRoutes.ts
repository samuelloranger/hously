import { Elysia } from 'elysia';
import { createJsonSseResponse } from '../../utils/sse';
import { fetchGiteaBuildStatus, isBuildActive } from '../../utils/dashboard/gitea';

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
      poll: () => fetchGiteaBuildStatus(true),
      intervalMs: (snapshot) => {
        // 3s when building, 10s idle (so new builds show up within ~10s)
        if (isBuildActive() || snapshot.building) {
          return 3000;
        }
        return 10000;
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
