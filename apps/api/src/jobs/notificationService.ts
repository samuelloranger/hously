/**
 * Notification service for creating and enqueuing push notifications
 */

import { prisma } from '../db';
import { nowUtc, getTimezone } from '../utils';
import { addJob, QUEUE_NAMES } from '../services/queueService';
import type { NotificationJobData } from '../services/jobs/notificationWorker';
import { normalizeNotificationUrl } from '@hously/shared';

/**
 * Check if current time is in night period (23h-6h) when notifications should not be sent
 */
export function isNightTime(): boolean {
  const tz = getTimezone();
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
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
 * Create a notification record and enqueue a push delivery job
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
    const normalizedUrl = normalizeNotificationUrl(url);

    // 1. Create notification record in DB immediately
    // This ensures the user sees it in their notification center in the app
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: notificationType,
        url: normalizedUrl,
        notificationMetadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        read: false,
        createdAt: nowUtc(),
      },
    });

    console.log(`[NotificationService] Created notification ${notification.id} for user ${userId}. Enqueuing push job.`);

    // 2. Enqueue the actual push delivery to BullMQ
    await addJob<NotificationJobData>(
      QUEUE_NAMES.NOTIFICATIONS,
      `send-push:${notification.id}`,
      {
        notificationId: notification.id,
        userId,
        title,
        body,
        notificationType,
        url: normalizedUrl || undefined,
        metadata,
      }
    );

    return true;
  } catch (error) {
    console.error(`[NotificationService] Error creating/enqueuing notification for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all users (for sending broadcast notifications)
 */
export async function getAllUsers(): Promise<Array<{ id: number; locale: string | null }>> {
  return prisma.user.findMany({
    select: { id: true, locale: true },
  });
}
