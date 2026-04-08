import type { Job } from "bullmq";
import { SCHEDULED_JOB_NAMES } from "@hously/api/services/queueService";

/**
 * Worker to process scheduled (repeatable) jobs and on-demand background tasks
 */
export async function processScheduledJob(job: Job) {
  const startedAt = Date.now();
  console.log(`[ScheduledTasksWorker] Starting job: ${job.name} (${job.id})`);

  try {
    switch (job.name) {
      case SCHEDULED_JOB_NAMES.CHECK_REMINDERS: {
        const { checkAndSendReminders } =
          await import("../../workers/checkReminders");
        await checkAndSendReminders();
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_ALL_DAY_EVENTS: {
        const { checkAndSendAllDayEventNotifications } =
          await import("../../workers/checkAllDayEvents");
        await checkAndSendAllDayEventNotifications();
        break;
      }
      case SCHEDULED_JOB_NAMES.CLEANUP_NOTIFICATIONS: {
        const { cleanupOldNotifications } =
          await import("../../workers/cleanupNotifications");
        await cleanupOldNotifications();
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_TRACKER_STATS: {
        const { fetchAllTrackerStats, fetchTrackerStats } =
          await import("../../workers/fetchTrackerStats");
        const { type } = job.data as { type?: string };
        if (type) {
          await fetchTrackerStats(type as any, { trigger: "queue" });
        } else {
          await fetchAllTrackerStats({ trigger: "queue" });
        }
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_C411_STATS: {
        const { fetchTrackerStats } =
          await import("../../workers/fetchTrackerStats");
        await fetchTrackerStats("c411", { trigger: "queue" });
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_TORR9_STATS: {
        const { fetchTrackerStats } =
          await import("../../workers/fetchTrackerStats");
        await fetchTrackerStats("torr9", { trigger: "queue" });
        break;
      }
      case SCHEDULED_JOB_NAMES.FETCH_LA_CALE_STATS: {
        const { fetchTrackerStats } =
          await import("../../workers/fetchTrackerStats");
        await fetchTrackerStats("la-cale", { trigger: "queue" });
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_HABIT_REMINDERS: {
        const { checkHabitReminders } =
          await import("../../workers/checkHabitReminders");
        await checkHabitReminders();
        break;
      }
      case SCHEDULED_JOB_NAMES.REFRESH_UPCOMING: {
        const { refreshUpcoming } = await import("../../workers/refreshUpcoming");
        await refreshUpcoming({ trigger: "queue" });
        break;
      }
      case SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAKS: {
        const { refreshHabitsStreaks } =
          await import("../../workers/refreshHabitsStreaks");
        await refreshHabitsStreaks({ trigger: "queue" });
        break;
      }
      case SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER: {
        const { refreshHabitsStreakForUser } =
          await import("../../utils/dashboard/habitsStreak");
        const { userId } = job.data as { userId: number };
        await refreshHabitsStreakForUser(userId);
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_MOVIE_RELEASE_REMINDERS: {
        const { checkMovieReleaseReminders } =
          await import("../../workers/checkMovieReleaseReminders");
        await checkMovieReleaseReminders();
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_LIBRARY_MOVIE_RELEASES: {
        const { checkMovieReleases } =
          await import("../../workers/checkMovieReleases");
        await checkMovieReleases();
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_LIBRARY_EPISODE_RELEASES: {
        const { checkEpisodeReleases } =
          await import("../../workers/checkEpisodeReleases");
        await checkEpisodeReleases();
        break;
      }
      case SCHEDULED_JOB_NAMES.SYNC_LIBRARY_SHOW_EPISODES: {
        const { syncShowEpisodes } =
          await import("../../workers/syncShowEpisodes");
        await syncShowEpisodes();
        break;
      }
      case SCHEDULED_JOB_NAMES.CHECK_LIBRARY_DOWNLOAD_COMPLETION: {
        const { checkDownloadCompletion } =
          await import("../../workers/checkDownloadCompletion");
        await checkDownloadCompletion();
        break;
      }
      default:
        console.warn(`[ScheduledTasksWorker] Unknown job name: ${job.name}`);
        return { success: false, error: "Unknown job name" };
    }

    const duration = Date.now() - startedAt;
    console.log(
      `[ScheduledTasksWorker] Completed job: ${job.name} in ${duration}ms`,
    );
    return { success: true, duration };
  } catch (error) {
    console.error(`[ScheduledTasksWorker] Job failed: ${job.name}`, error);
    throw error;
  }
}
