import { Prisma } from '@prisma/client';
import { addJob, QUEUE_NAMES } from '../services/queueService';

export type ActivityLogType =
  | 'plugin_updated'
  | 'cron_job_ended'
  | 'cron_job_skipped'
  | 'app_updated'
  | 'recipe_added'
  | 'recipe_updated'
  | 'recipe_deleted'
  | 'admin_triggered_job'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'shopping_item_added'
  | 'shopping_item_completed'
  | 'shopping_list_cleared'
  | 'media_conversion_started'
  | 'media_conversion_ended';

/**
 * Enqueue an activity log to be processed in the background
 */
export async function logActivity(input: {
  type: ActivityLogType;
  userId?: number | null;
  payload?: Prisma.InputJsonValue;
  createdAt?: Date;
}): Promise<void> {
  try {
    // Add job to BullMQ
    await addJob(
      QUEUE_NAMES.ACTIVITY_LOGS,
      `log:${input.type}`,
      {
        type: input.type,
        userId: input.userId ?? null,
        payload: input.payload,
        createdAt: (input.createdAt ?? new Date()).toISOString(),
      }
    );
  } catch (error) {
    console.warn('[ActivityLogs] Failed to enqueue activity log:', error);
  }
}
