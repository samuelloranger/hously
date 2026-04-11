import { Prisma } from "@prisma/client";
import { addJob, QUEUE_NAMES } from "@hously/api/services/queueService";

export type ActivityLogType =
  | "plugin_updated"
  | "cron_job_ended"
  | "cron_job_skipped"
  | "app_updated"
  | "admin_triggered_job"
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "shopping_item_added"
  | "shopping_item_completed"
  | "shopping_list_cleared"
  | "media_grab";

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
    await addJob(QUEUE_NAMES.ACTIVITY_LOGS, `log:${input.type}`, {
      type: input.type,
      userId: input.userId ?? null,
      payload: input.payload,
      createdAt: (input.createdAt ?? new Date()).toISOString(),
    });
  } catch (error) {
    console.warn("[ActivityLogs] Failed to enqueue activity log:", error);
  }
}
