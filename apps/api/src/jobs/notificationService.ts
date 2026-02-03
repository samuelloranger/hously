/**
 * Notification service for creating and sending push notifications
 */

import { db } from "../db";
import { notifications, userSubscriptions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { sendWebPushNotification, type PushSubscription } from "../utils/webpush";
import { nowUtc, getTimezone } from "../utils";

/**
 * Check if current time is in night period (23h-6h) when notifications should not be sent
 */
export function isNightTime(): boolean {
  const tz = getTimezone();
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now));

  const isNight = currentHour >= 23 || currentHour < 6;

  if (isNight) {
    console.log(`Night time detected (current hour: ${currentHour}). Skipping notifications.`);
  }

  return isNight;
}

interface NotificationMetadata {
  chore_id?: number;
  reminder_id?: number;
  custom_event_id?: number;
  [key: string]: unknown;
}

/**
 * Create a notification record and send web push to all user devices
 */
export async function createAndQueueNotification(
  userId: number,
  title: string,
  body: string,
  notificationType: string,
  url?: string,
  metadata?: NotificationMetadata
): Promise<boolean> {
  try {
    // Create notification record
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        title,
        body,
        type: notificationType,
        url: url || null,
        notificationMetadata: metadata || null,
        read: false,
        createdAt: nowUtc(),
      })
      .returning();

    console.log(`Created notification ${notification.id} for user ${userId}: ${title}`);

    // Get all subscriptions for this user
    const subscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return true; // Notification created, just no push delivery
    }

    // Send push notification to all user devices
    for (const sub of subscriptions) {
      try {
        const subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;

        const result = await sendWebPushNotification(subscriptionInfo, {
          title,
          body,
          tag: notificationType,
          data: {
            url,
            notification_type: notificationType,
            notification_id: notification.id,
            ...metadata,
          },
        });

        if (result.expired) {
          // Delete expired subscription
          await db
            .delete(userSubscriptions)
            .where(eq(userSubscriptions.id, sub.id));
          console.log(`Deleted expired subscription ${sub.id} for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error sending push to subscription ${sub.id}:`, error);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error creating notification for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all users (for sending notifications to all household members)
 */
export async function getAllUsers(): Promise<Array<{ id: number; locale: string | null }>> {
  return db.select({ id: users.id, locale: users.locale }).from(users);
}
