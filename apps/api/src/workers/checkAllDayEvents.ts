/**
 * Cron job: Check for all-day custom events starting tomorrow and send notifications
 * Runs daily at 8:00 PM
 */

import { buildNotificationUrl } from "@hously/shared/utils";
import { prisma } from "@hously/api/db";
import {
  todayLocal,
  addDaysInTz,
  formatDateInTimezone,
} from "@hously/api/utils";
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

  // Calculate tomorrow's date range (midnight-to-midnight in configured timezone)
  const tomorrowStart = addDaysInTz(today, 1);
  const tomorrowEnd = new Date(addDaysInTz(today, 2).getTime() - 1);

  try {
    // Get all-day custom events that start tomorrow
    const events = await prisma.customEvent.findMany({
      where: {
        allDay: true,
        startDatetime: {
          gte: tomorrowStart.toISOString(),
          lte: tomorrowEnd.toISOString(),
        },
      },
      include: {
        user: true,
      },
    });

    let sentCount = 0;

    for (const event of events) {
      const user = event.user;
      const locale = user.locale || "en";

      const title =
        locale === "fr"
          ? `Événement demain: ${event.title}`
          : `All-day event tomorrow: ${event.title}`;
      const body =
        locale === "fr"
          ? `Votre événement '${event.title}' est prévu pour demain`
          : `Your all-day event '${event.title}' is scheduled for tomorrow`;
      const url = buildNotificationUrl("/calendar", {
        date: formatDateInTimezone(event.startDatetime),
        eventId: event.id,
      });
      const metadata = { custom_event_id: event.id };

      const success = await createAndQueueNotification(
        user.id,
        title,
        body,
        "custom_event",
        url,
        metadata,
      );

      if (success) {
        sentCount++;
      }
    }

    console.log(
      `[CRON] Sent ${sentCount} all-day event notifications for tomorrow`,
    );
  } catch (error) {
    console.error("[CRON] Error checking all-day events:", error);
  }
}
