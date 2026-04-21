import type { Job } from "bullmq";
import { prisma } from "@hously/api/db";
import {
  sendWebPushNotification,
  type PushSubscription,
} from "@hously/api/utils/webpush";
import { sendApnNotifications } from "@hously/api/utils/apnPush";
import { dispatchToChannel } from "@hously/api/utils/notifications/channelDispatchers";
import { getBaseUrl } from "@hously/api/config";
import { NOTIFICATION_JOB_NAMES } from "@hously/api/services/queueService";

function toAbsoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) return url;
  const base = getBaseUrl().replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

export interface SilentPushJobData {
  userId: number;
  type: string;
}

export interface NotificationJobData {
  notificationId: number;
  userId: number;
  title: string;
  body: string;
  notificationType: string;
  url?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function processNotificationJob(job: Job) {
  if (job.name === NOTIFICATION_JOB_NAMES.SILENT_PUSH) {
    return processSilentPushJob(job as Job<SilentPushJobData>);
  }
  return processRegularNotificationJob(job as Job<NotificationJobData>);
}

async function processSilentPushJob(job: Job<SilentPushJobData>) {
  const { userId, type } = job.data;
  const { sendSilentPushToUser } =
    await import("../externalNotificationService");
  await sendSilentPushToUser(userId, type);
  return { success: true };
}

async function processRegularNotificationJob(job: Job<NotificationJobData>) {
  const {
    notificationId,
    userId,
    title,
    body,
    notificationType,
    url,
    imageUrl,
    metadata,
  } = job.data;

  console.log(
    `[NotificationWorker] Processing notification ${notificationId} for user ${userId}`,
  );

  // Send Web Push notifications (browser subscriptions)
  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId },
  });
  for (const sub of subscriptions) {
    try {
      let subscriptionInfo: PushSubscription;
      try {
        subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;
      } catch {
        console.error(
          `Invalid subscription JSON for subscription ${sub.id}, skipping`,
        );
        continue;
      }

      const result = await sendWebPushNotification(subscriptionInfo, {
        title,
        body,
        tag: notificationType,
        image: imageUrl,
        data: {
          url,
          notification_type: notificationType,
          notification_id: notificationId,
          ...metadata,
        },
      });

      if (result.expired) {
        await prisma.userSubscription.delete({ where: { id: sub.id } });
        console.log(
          `Deleted expired subscription ${sub.id} for user ${userId}`,
        );
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
    const iosTokens = pushTokens
      .filter((t) => t.platform === "ios")
      .map((t) => t.token);
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    if (iosTokens.length > 0) {
      const { successCount, invalidTokens } = await sendApnNotifications(
        iosTokens,
        {
          title,
          body,
          imageUrl,
          data: {
            url,
            notification_type: notificationType,
            notification_id: notificationId,
            ...metadata,
          },
          channelId:
            notificationType === "reminder"
              ? "chore-reminders"
              : notificationType === "custom_event"
                ? "calendar-events"
                : "default",
          badge: unreadCount,
        },
      );

      if (successCount > 0) {
        console.log(
          `Sent ${successCount} APNs push notifications for user ${userId}`,
        );
      }

      if (invalidTokens.length > 0) {
        await prisma.pushToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(
          `Deleted ${invalidTokens.length} invalid APNs push tokens for user ${userId}`,
        );
      }
    }
  }

  // Dispatch to user-configured channels (provider-agnostic — routed by
  // dispatchToChannel, which parses `config` at the boundary)
  const channels = await prisma.notificationChannel.findMany({
    where: { userId, enabled: true },
    select: { id: true, type: true, label: true, config: true },
  });
  const absoluteUrl = toAbsoluteUrl(url);
  for (const channel of channels) {
    try {
      await dispatchToChannel(channel, { title, body, url: absoluteUrl });
    } catch (err) {
      console.error(
        `[NotificationWorker] Channel ${channel.id} (${channel.type}) failed:`,
        err,
      );
    }
  }

  return { success: true };
}
