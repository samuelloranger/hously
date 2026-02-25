import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cron } from '@elysiajs/cron';

import { cors } from '@elysiajs/cors';
import {
  checkAndSendReminders,
  checkAndSendAllDayEventNotifications,
  cleanupOldNotifications,
  fetchAllTrackerStats,
} from './jobs';
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
import { pluginsRoutes } from './routes/plugins';
import { mediasRoutes } from './routes/medias';
import { globalRateLimit } from './middleware/rateLimit';
import { logActivity } from './utils/activityLogs';

const runCronJobWithActivity = async (job: { id: string; name: string }, fn: () => Promise<unknown>): Promise<void> => {
  const startedAt = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - startedAt;
    await logActivity({
      type: 'cron_job_ended',
      payload: { job_id: job.id, job_name: job.name, success: true, duration_ms: durationMs, trigger: 'cron' },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Unknown error';
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: job.id,
        job_name: job.name,
        success: false,
        duration_ms: durationMs,
        trigger: 'cron',
        message,
      },
    });
  }
};

export const app = new Elysia()
  .use(
    cors({
      origin: Bun.env.CORS_ORIGIN || 'http://localhost:5173', // Frontend URL
      credentials: true,
    })
  )
  .use(swagger())
  // Cron jobs
  .use(
    cron({
      name: 'checkReminders',
      pattern: '*/15 * * * *', // Every 15 minutes
      run: () => runCronJobWithActivity({ id: 'checkReminders', name: 'Check reminders' }, checkAndSendReminders),
    })
  )
  .use(
    cron({
      name: 'checkAllDayEvents',
      pattern: '0 20 * * *', // Daily at 8 PM
      run: () =>
        runCronJobWithActivity(
          { id: 'checkAllDayEvents', name: 'Check all-day events' },
          checkAndSendAllDayEventNotifications
        ),
    })
  )
  .use(
    cron({
      name: 'cleanupNotifications',
      pattern: '0 0 * * *', // Daily at midnight
      run: () =>
        runCronJobWithActivity(
          { id: 'cleanupNotifications', name: 'Cleanup old notifications' },
          cleanupOldNotifications
        ),
    })
  )
  .use(
    cron({
      name: 'fetchTrackerStats',
      pattern: '0 * * * *', // Hourly
      run: () =>
        runCronJobWithActivity({ id: 'fetchTrackerStats', name: 'Fetch tracker stats' }, () =>
          fetchAllTrackerStats({ trigger: 'cron' })
        ),
    })
  )
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
  .use(pluginsRoutes)
  .use(mediasRoutes)
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({ status: 'ok' }))
  .get('/api/health', () => ({ status: 'ok' }));

if (import.meta.main) {
  app.listen(3000);
  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

  // Check for version change after the server is up and ready
  checkAndNotifyVersionChange().catch(err => {
    console.error('Failed to check version change after startup:', err);
  });
}
