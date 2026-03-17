import type { Job } from 'bullmq';
import { SCHEDULED_JOB_NAMES } from '../queueService';

/**
 * Worker to process scheduled (repeatable) jobs and on-demand background tasks
 */
export async function processScheduledJob(job: Job) {
  const startedAt = Date.now();
  console.log(`[ScheduledTasksWorker] Starting job: ${job.name} (${job.id})`);

  try {
    switch (job.name) {
      case SCHEDULED_JOB_NAMES.CHECK_REMINDERS: {
        const { checkAndSendReminders } = await import('../../jobs/checkReminders');
        await checkAndSendReminders();
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_ALL_DAY_EVENTS: {
        const { checkAndSendAllDayEventNotifications } = await import('../../jobs/checkAllDayEvents');
        await checkAndSendAllDayEventNotifications();
        break;
      }
      case SCHEDULED_JOB_NAMES.CLEANUP_NOTIFICATIONS: {
        const { cleanupOldNotifications } = await import('../../jobs/cleanupNotifications');
        await cleanupOldNotifications();
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_TRACKER_STATS: {
        const { fetchAllTrackerStats, fetchTrackerStats } = await import('../../jobs/fetchTrackerStats');
        const { type } = job.data as { type?: string };
        if (type) {
          await fetchTrackerStats(type as any, { trigger: 'queue' });
        } else {
          await fetchAllTrackerStats({ trigger: 'queue' });
        }
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_C411_STATS: {
        const { fetchTrackerStats } = await import('../../jobs/fetchTrackerStats');
        await fetchTrackerStats('c411', { trigger: 'queue' });
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_TORR9_STATS: {
        const { fetchTrackerStats } = await import('../../jobs/fetchTrackerStats');
        await fetchTrackerStats('torr9', { trigger: 'queue' });
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_LA_CALE_STATS: {
        const { fetchTrackerStats } = await import('../../jobs/fetchTrackerStats');
        await fetchTrackerStats('la-cale', { trigger: 'queue' });
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_HABIT_REMINDERS: {
        const { checkHabitReminders } = await import('../../jobs/checkHabitReminders');
        await checkHabitReminders();
        break;
      }
      case SCHEDULED_JOB_NAMES.REFRESH_UPCOMING: {
        const { refreshUpcoming } = await import('../../jobs/refreshUpcoming');
        await refreshUpcoming({ trigger: 'queue' });
        break;
      }
      case SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAKS: {
        const { refreshHabitsStreaks } = await import('../../jobs/refreshHabitsStreaks');
        await refreshHabitsStreaks({ trigger: 'queue' });
        break;
      }
      default:
        console.warn(`[ScheduledTasksWorker] Unknown job name: ${job.name}`);
        return { success: false, error: 'Unknown job name' };
    }

    const duration = Date.now() - startedAt;
    console.log(`[ScheduledTasksWorker] Completed job: ${job.name} in ${duration}ms`);
    return { success: true, duration };
  } catch (error) {
    console.error(`[ScheduledTasksWorker] Job failed: ${job.name}`, error);
    throw error;
  }
}
