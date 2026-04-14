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
  | "shopping_item_toggled"
  | "shopping_item_updated"
  | "shopping_item_deleted"
  | "shopping_bulk_deleted"
  | "shopping_reordered"
  | "shopping_list_cleared"
  | "chore_created"
  | "chore_toggled"
  | "chore_updated"
  | "chore_recurrence_removed"
  | "chore_completed_cleared"
  | "chore_deleted"
  | "chore_reordered"
  | "chore_image_uploaded"
  | "notification_push_subscription_saved"
  | "notification_welcome_sent"
  | "notification_unsubscribed"
  | "notification_register_device"
  | "notification_unregister_device"
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
