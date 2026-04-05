/**
 * Cron job: Check for reminders that need to be sent and send notifications
 * Runs every 15 minutes
 */

import { buildNotificationUrl } from "@hously/shared";
import { prisma } from "@hously/api/db";
import { formatDateInTimezone, nowUtc, getTimezone } from "@hously/api/utils";
import {
  isNightTime,
  createAndQueueNotification,
  getAllUsers,
} from "./notificationService";

/**
 * Check for due reminders and send notifications
 *
 * Logic:
 * - If chore is assigned to a user: send only to that user
 * - If chore is not assigned: send to all users
 * - Only send when reminder_datetime has been reached
 * - Send initial notification at reminder time, then repeat every 5 minutes
 */
export async function checkAndSendReminders(): Promise<void> {
  console.log("[CRON] Running checkAndSendReminders...");

  // Skip notifications during night time (23h-6h)
  if (isNightTime()) {
    return;
  }

  const nowUtcDt = new Date();
  const repeatIntervalMinutes = 5;
  const repeatIntervalAgo = new Date(
    nowUtcDt.getTime() - repeatIntervalMinutes * 60 * 1000,
  );

  try {
    // Get active reminders where:
    // 1. reminder_datetime <= now (reminder time has been reached)
    // 2. chore is not completed
    // 3. Either never sent OR last sent more than 5 minutes ago
    // 4. reminder is active
    const dueReminders = await prisma.reminder.findMany({
      where: {
        active: true,
        reminderDatetime: { lte: nowUtcDt.toISOString() },
        chore: {
          completed: false,
        },
        OR: [
          { lastNotificationSent: null },
          { lastNotificationSent: { lte: repeatIntervalAgo.toISOString() } },
        ],
      },
      include: {
        chore: true,
      },
    });

    let sentCount = 0;

    for (const reminder of dueReminders) {
      const chore = reminder.chore;
      const choreName = chore.choreName;
      const assignedTo = chore.assignedTo;

      // Get all users for broadcast notifications
      const allUsers = await getAllUsers();

      // Determine who should receive the notification
      let targetUsers: Array<{ id: number; locale: string | null }>;
      if (assignedTo) {
        // Chore is assigned: send only to assigned user
        targetUsers = allUsers.filter((user) => user.id === assignedTo);
      } else {
        // Chore is not assigned: send to all users
        targetUsers = allUsers;
      }

      let notificationSent = false;

      for (const user of targetUsers) {
        const locale = user.locale || "en";
        const title =
          locale === "fr" ? `Rappel: ${choreName}` : `Reminder: ${choreName}`;
        const body =
          locale === "fr"
            ? `C'est le temps de faire: ${choreName}`
            : `Time to do: ${choreName}`;
        const url = "/chores";
        const metadata = { chore_id: chore.id, reminder_id: reminder.id };

        const success = await createAndQueueNotification(
          user.id,
          title,
          body,
          "reminder",
          url,
          metadata,
        );

        if (success) {
          notificationSent = true;
          sentCount++;
        }
      }

      // Update last_notification_sent for the reminder
      if (notificationSent) {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { lastNotificationSent: nowUtc() },
        });
      }
    }

    // Also check for custom events starting soon
    await checkAndSendCustomEventNotifications();

    console.log(`[CRON] Sent ${sentCount} reminder notifications`);
  } catch (error) {
    console.error("[CRON] Error checking reminders:", error);
  }
}

/**
 * Check for custom events that start within the next 15 minutes and send notifications
 */
async function checkAndSendCustomEventNotifications(): Promise<void> {
  // Skip notifications during night time
  if (isNightTime()) {
    return;
  }

  const nowUtcDt = new Date();
  const windowEnd = new Date(nowUtcDt.getTime() + 15 * 60 * 1000);

  try {
    // Get custom events that start within the next 15 minutes and are not all_day
    const events = await prisma.customEvent.findMany({
      where: {
        allDay: false,
        startDatetime: {
          gte: nowUtcDt.toISOString(),
          lte: windowEnd.toISOString(),
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

      // Format time for notification
      const tz = getTimezone();
      const eventStart = new Date(event.startDatetime);
      const timeStr = eventStart.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const title =
        locale === "fr"
          ? `Événement bientôt: ${event.title}`
          : `Event starting soon: ${event.title}`;
      const body =
        locale === "fr"
          ? `Votre événement '${event.title}' commence à ${timeStr}`
          : `Your event '${event.title}' starts at ${timeStr}`;
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

    if (sentCount > 0) {
      console.log(`[CRON] Sent ${sentCount} custom event notifications`);
    }
  } catch (error) {
    console.error("[CRON] Error checking custom events:", error);
  }
}
