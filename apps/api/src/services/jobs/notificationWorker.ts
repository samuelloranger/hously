import type { Job } from 'bullmq';
import { prisma } from '../../db';
import { sendWebPushNotification, type PushSubscription } from '../../utils/webpush';
import { sendApnNotifications } from '../../utils/apnPush';

export interface NotificationJobData {
  notificationId: number;
  userId: number;
  title: string;
  body: string;
  notificationType: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export async function processNotificationJob(job: Job<NotificationJobData>) {
  const { notificationId, userId, title, body, notificationType, url, metadata } = job.data;

  console.log(`[NotificationWorker] Processing notification ${notificationId} for user ${userId}`);

  // Send Web Push notifications (browser subscriptions)
  const subscriptions = await prisma.userSubscription.findMany({ where: { userId } });
  for (const sub of subscriptions) {
    try {
      let subscriptionInfo: PushSubscription;
      try {
        subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;
      } catch {
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
          notification_id: notificationId,
          ...metadata,
        },
      });

      if (result.expired) {
        await prisma.userSubscription.delete({ where: { id: sub.id } });
        console.log(`Deleted expired subscription ${sub.id} for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error sending push to subscription ${sub.id}:`, error);
    }
  }

  // Send APNs notifications (mobile push tokens)
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { id: true, token: true, platform: true },
  });

  if (pushTokens.length > 0) {
    const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    if (iosTokens.length > 0) {
      const { successCount, invalidTokens } = await sendApnNotifications(iosTokens, {
        title,
        body,
        data: {
          url,
          notification_type: notificationType,
          notification_id: notificationId,
          ...metadata,
        },
        channelId:
          notificationType === 'reminder'
            ? 'chore-reminders'
            : notificationType === 'custom_event'
              ? 'calendar-events'
              : 'default',
        badge: unreadCount,
      });

      if (successCount > 0) {
        console.log(`Sent ${successCount} APNs push notifications for user ${userId}`);
      }

      if (invalidTokens.length > 0) {
        await prisma.pushToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(`Deleted ${invalidTokens.length} invalid APNs push tokens for user ${userId}`);
      }
    }
  }

  return { success: true };
}
