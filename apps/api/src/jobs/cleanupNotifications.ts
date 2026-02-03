/**
 * Cron job: Clean up notifications older than 30 days
 * Runs daily at midnight
 */

import { db } from "../db";
import { notifications } from "../db/schema";
import { lt } from "drizzle-orm";

/**
 * Clean up notifications older than 30 days
 */
export async function cleanupOldNotifications(): Promise<number> {
  console.log("[CRON] Running cleanupOldNotifications...");

  try {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Delete notifications older than 30 days
    const result = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoffDate.toISOString()))
      .returning({ id: notifications.id });

    const deletedCount = result.length;

    console.log(`[CRON] Cleaned up ${deletedCount} notifications older than 30 days`);
    return deletedCount;
  } catch (error) {
    console.error("[CRON] Error cleaning up old notifications:", error);
    return 0;
  }
}
