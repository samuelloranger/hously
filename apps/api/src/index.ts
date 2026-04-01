import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';

import { cors } from '@elysiajs/cors';
import { checkAndNotifyVersionChange } from './services/versionService';
import { auth } from './auth';
import { dashboardRoutes } from './routes/dashboard';
import { usersRoutes } from './routes/users';
import { notificationsRoutes } from './routes/notifications';
import { webhooksRoutes } from './routes/webhooks';
import { externalNotificationsRoutes } from './routes/externalNotifications';
import { choresRoutes } from './routes/chores';
import { shoppingRoutes } from './routes/shopping';
import { calendarRoutes } from './routes/calendar';
import { icalFeedRoutes } from './routes/icalFeed';
import { customEventsRoutes } from './routes/customEvents';
import { mealPlansRoutes } from './routes/mealPlans';
import { recipesRoutes } from './routes/recipes';
import { remindersRoutes } from './routes/reminders';
import { adminRoutes } from './routes/admin';
import { analyticsRoutes } from './routes/analytics';
import { trackerPluginsRoutes } from './routes/plugins/trackerPlugins';
import { mediaPluginsRoutes } from './routes/plugins/mediaPlugins';
import { monitoringPluginsRoutes } from './routes/plugins/monitoringPlugins';
import { dashboardPluginsRoutes } from './routes/plugins/dashboardPlugins';
import { homeAssistantRoutes } from './routes/homeAssistant';
import { mediasLibraryRoutes } from './routes/medias/library';
import { mediasTmdbRoutes } from './routes/medias/tmdb';
import { mediasProwlarrRoutes } from './routes/medias/prowlarr';
import { mediasArrRoutes } from './routes/medias/arr';
import { mediasWatchlistRoutes } from './routes/medias/watchlist';
import { mediasCollectionsRoutes } from './routes/medias/collections';
import { mediasAiSuggestionsRoutes } from './routes/medias/aiSuggestions';
import { habitsRoutes } from './routes/habits';
import { systemRoutes } from './routes/system';
import { searchRoutes } from './routes/search';
import { globalRateLimit } from './middleware/rateLimit';
import { initWorkers, setupScheduledJobs } from './services/queueService';

const serveStatic = Bun.env.SERVE_STATIC === 'true';

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN || 'http://localhost:5173', // Frontend URL
      credentials: true,
    })
  )
  .use(swagger())
  .use(app => {
    console.log('Elysia app initialized');
    if (Bun.env.LOG_LEVEL === 'debug') {
      app.on('beforeHandle', context => {
        console.log(`Incoming request: ${context.request.method} ${context.path}`);
      });
    }
    return app;
  })
  .use(auth)
  .use(globalRateLimit) // Global rate limiting for unauthenticated requests
  .use(dashboardRoutes)
  .use(usersRoutes)
  .use(notificationsRoutes)
  .use(webhooksRoutes)
  .use(externalNotificationsRoutes)
  .use(choresRoutes)
  .use(shoppingRoutes)
  .use(icalFeedRoutes)
  .use(calendarRoutes)
  .use(customEventsRoutes)
  .use(mealPlansRoutes)
  .use(recipesRoutes)
  .use(remindersRoutes)
  .use(adminRoutes)
  .use(analyticsRoutes)
  .use(trackerPluginsRoutes)
  .use(mediaPluginsRoutes)
  .use(monitoringPluginsRoutes)
  .use(dashboardPluginsRoutes)
  .use(homeAssistantRoutes)
  .use(mediasLibraryRoutes)
  .use(mediasTmdbRoutes)
  .use(mediasProwlarrRoutes)
  .use(mediasArrRoutes)
  .use(mediasWatchlistRoutes)
  .use(mediasCollectionsRoutes)
  .use(mediasAiSuggestionsRoutes)
  .use(habitsRoutes)
  .use(systemRoutes)
  .use(searchRoutes)
  .get('/health', () => ({ status: 'ok' }))
  .get('/api/health', () => ({ status: 'ok' }))
  .use(app => {
    if (serveStatic) {
      // On Bun, @elysiajs/static imports .html as modules; Vite's index.html is plain HTML, so those routes
      // return empty bodies. Ignore *.html here and serve the SPA shell via Bun.file below.
      app
        .use(
          staticPlugin({
            assets: './public',
            prefix: '/',
            ignorePatterns: [/\.html$/],
          })
        )
        .get('*', () => Bun.file('./public/index.html'));
    }
    return app;
  });

if (import.meta.main) {
  // 1. Initialize BullMQ Workers
  initWorkers();

  // 2. Setup Scheduled Tasks (Crons)
  setupScheduledJobs().catch(err => {
    console.error('Failed to setup scheduled jobs:', err);
  });

  // 3. Start Server
  app.listen(process.env.API_PORT || 3000);
  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

  // 4. Post-startup tasks
  checkAndNotifyVersionChange().catch(err => {
    console.error('Failed to check version change after startup:', err);
  });
}
