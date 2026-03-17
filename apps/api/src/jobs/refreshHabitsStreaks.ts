import { refreshAllHabitsStreaks } from '../utils/dashboard/habitsStreak';
import { logActivity } from '../utils/activityLogs';

let isRunning = false;

const JOB_ID = 'refreshHabitsStreaks';
const JOB_NAME = 'Refresh habits streaks';

export const refreshHabitsStreaks = async (options?: { trigger?: 'cron' | 'manual' | 'queue' }): Promise<void> => {
  const trigger = options?.trigger ?? 'cron';

  if (isRunning) return;
  isRunning = true;
  const startedAt = Date.now();

  try {
    const userCount = await refreshAllHabitsStreaks();
    console.log(`[cron:habits-streaks] Refreshed streaks for ${userCount} users`);
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: JOB_ID,
        job_name: JOB_NAME,
        success: true,
        duration_ms: Date.now() - startedAt,
        trigger,
        message: `Refreshed ${userCount} users`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron:habits-streaks] Failed:', message);
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: JOB_ID,
        job_name: JOB_NAME,
        success: false,
        duration_ms: Date.now() - startedAt,
        trigger,
        message,
      },
    });
  } finally {
    isRunning = false;
  }
};
