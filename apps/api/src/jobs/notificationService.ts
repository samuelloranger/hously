/**
 * Notification service for creating and sending push notifications
 */

import { prisma } from "../db";
import { sendWebPushNotification, type PushSubscription } from "../utils/webpush";
import { sendExpoPushNotifications } from "../utils/expoPush";
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
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: notificationType,
        url: url || null,
        notificationMetadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        read: false,
        createdAt: nowUtc(),
      },
    });

    console.log(`Created notification ${notification.id} for user ${userId}: ${title}`);

    // Send Web Push notifications (browser subscriptions)
    const subscriptions = await prisma.userSubscription.findMany({ where: { userId } });
    for (const sub of subscriptions) {
      try {
        let subscriptionInfo: PushSubscription;
        try {
          subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;
        } catch (parseError) {
          console.error(`Invalid subscription JSON for subscription ${sub.id}, skipping`);
          continue;
        }

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
          await prisma.userSubscription.delete({
            where: { id: sub.id },
          });
          console.log(`Deleted expired subscription ${sub.id} for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error sending push to subscription ${sub.id}:`, error);
      }
    }

    // Send Expo/EAS notifications (mobile push tokens)
    const pushTokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    if (pushTokens.length > 0) {
      const { successCount, invalidTokens } = await sendExpoPushNotifications(
        pushTokens.map((t) => t.token),
        {
          title,
          body,
          data: {
            url,
            notification_type: notificationType,
            notification_id: notification.id,
            ...metadata,
          },
          channelId:
            notificationType === "reminder"
              ? "chore-reminders"
              : notificationType === "custom_event"
                ? "calendar-events"
                : "default",
        }
      );

      if (successCount > 0) {
        console.log(`Sent ${successCount} Expo push notifications for user ${userId}`);
      }

      if (invalidTokens.length > 0) {
        await prisma.pushToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(`Deleted ${invalidTokens.length} invalid Expo push tokens for user ${userId}`);
      }
    } else if (subscriptions.length === 0) {
      console.log(`No web subscriptions or mobile push tokens found for user ${userId}`);
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
  return prisma.user.findMany({
    select: { id: true, locale: true },
  });
}
