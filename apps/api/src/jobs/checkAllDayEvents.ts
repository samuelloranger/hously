/**
 * Cron job: Check for all-day custom events starting tomorrow and send notifications
 * Runs daily at 8:00 PM
 */

import { db } from "../db";
import { customEvents, users } from "../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { todayLocal } from "../utils";
import { isNightTime, createAndQueueNotification } from "./notificationService";

/**
 * Check for all-day custom events starting tomorrow and send notifications
 *
 * Logic:
 * - Get all custom events that are all_day and start tomorrow
 * - Send notifications to the event owner
 */
export async function checkAndSendAllDayEventNotifications(): Promise<void> {
  console.log("[CRON] Running checkAndSendAllDayEventNotifications...");

  // Skip notifications during night time (23h-6h)
  if (isNightTime()) {
    return;
  }

  const today = todayLocal();

  // Calculate tomorrow's date range
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Start of tomorrow (00:00:00)
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(0, 0, 0, 0);

  // End of tomorrow (23:59:59.999)
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  try {
    // Get all-day custom events that start tomorrow
    const events = await db
      .select({
        event: customEvents,
        user: users,
      })
      .from(customEvents)
      .innerJoin(users, eq(customEvents.userId, users.id))
      .where(
        and(
          eq(customEvents.allDay, true),
          gte(customEvents.startDatetime, tomorrowStart.toISOString()),
          lte(customEvents.startDatetime, tomorrowEnd.toISOString())
        )
      );

    let sentCount = 0;

    for (const { event, user } of events) {
      const locale = user.locale || "en";

      const title = locale === "fr"
        ? `Événement demain: ${event.title}`
        : `All-day event tomorrow: ${event.title}`;
      const body = locale === "fr"
        ? `Votre événement '${event.title}' est prévu pour demain`
        : `Your all-day event '${event.title}' is scheduled for tomorrow`;
      const url = "/calendar";
      const metadata = { custom_event_id: event.id };

      const success = await createAndQueueNotification(
        user.id,
        title,
        body,
        "custom_event",
        url,
        metadata
      );

      if (success) {
        sentCount++;
      }
    }

    console.log(`[CRON] Sent ${sentCount} all-day event notifications for tomorrow`);
  } catch (error) {
    console.error("[CRON] Error checking all-day events:", error);
  }
}
