import { prisma } from '../db';
import { sendWebPushNotification } from '../utils/webpush';
import { sendApnNotifications } from '../utils/apnPush';

/**
 * Generate a secure random token for webhook authentication
 */
export function generateServiceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Render a template string by replacing {{variable_name}} with actual values
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return '';

  return template.replace(/\{\{(\w+)\}\}/gi, (match, varName) => {
    const lowerVarName = varName.toLowerCase();
    for (const [key, value] of Object.entries(variables)) {
      if (key.toLowerCase() === lowerVarName) {
        return value ?? '';
      }
    }
    return match; // Keep original if not found
  });
}

/**
 * Get notification template for a specific service, event type, and language
 */
async function getTemplateForEvent(serviceName: string, eventType: string, language: string = 'en') {
  // First get the service
  const service = await prisma.externalNotificationService.findFirst({
    where: { serviceName },
  });

  if (!service) {
    console.warn(`Service ${serviceName} not found`);
    return null;
  }

  // Try to find template with exact language (only enabled templates)
  let template = await prisma.notificationTemplate.findFirst({
    where: {
      serviceId: service.id,
      eventType,
      language,
      enabled: true,
    },
  });

  // Fallback to English if not found
  if (!template && language !== 'en') {
    template = await prisma.notificationTemplate.findFirst({
      where: {
        serviceId: service.id,
        eventType,
        language: 'en',
        enabled: true,
      },
    });
  }

  return template;
}

/**
 * Send a silent background push notification to all user's iOS devices
 * This is used for background synchronization (e.g., calendar sync)
 */
export async function sendSilentPushToUser(userId: number, type: string): Promise<boolean> {
  try {
    const pushTokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });

    const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);

    if (iosTokens.length === 0) {
      return false;
    }

    const { successCount, invalidTokens } = await sendApnNotifications(iosTokens, {
      contentAvailable: true,
      data: { type },
    });

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
    }

    return successCount > 0;
  } catch (error) {
    console.error(`Error sending silent push to user ${userId}:`, error);
    return false;
  }
}

/**
 * Map external service names to their corresponding frontend URL paths
 */
const serviceUrlMap: Record<string, string> = {
  radarr: '/medias',
  sonarr: '/medias',
  jellyfin: '/medias',
  plex: '/medias',
  prowlarr: '/torrents',
  'cross-seed': '/torrents',
};

/**
 * Send external notification to all subscribed users
 */
export async function sendExternalNotification(
  serviceName: string,
  eventType: string,
  payload: {
    template_variables: Record<string, string>;
    original_payload: Record<string, unknown>;
  },
  language: string = 'en'
): Promise<boolean> {
  try {
    // Get template for this event
    const template = await getTemplateForEvent(serviceName, eventType, language);

    if (!template) {
      console.warn(`No template found for service=${serviceName}, event=${eventType}, language=${language}`);
      return false;
    }

    // Render templates
    const title = renderTemplate(template.titleTemplate, payload.template_variables);
    const body = renderTemplate(template.bodyTemplate, payload.template_variables);

    if (!title || !body) {
      console.error(`Rendered template is empty for ${serviceName}/${eventType}`);
      return false;
    }

    // Get the service to check notify_admins_only setting
    const service = await prisma.externalNotificationService.findFirst({
      where: { serviceName },
    });

    if (!service) {
      console.error(`Service ${serviceName} not found`);
      return false;
    }

    // Get user IDs based on notify_admins_only setting
    let targetUserIds: number[] = [];

    if (service.notifyAdminsOnly) {
      // Get only admin users
      const adminUsers = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });
      targetUserIds = adminUsers.map(u => u.id);

      if (targetUserIds.length === 0) {
        console.warn(`No admin users found. Cannot send external notifications for ${serviceName}.`);
        return false;
      }
    } else {
      // Get all users with at least one push delivery channel
      const allSubscriptions = await prisma.userSubscription.findMany({
        select: { userId: true },
      });
      const allPushTokens = await prisma.pushToken.findMany({
        select: { userId: true },
      });
      targetUserIds = [...new Set([...allSubscriptions.map(s => s.userId), ...allPushTokens.map(t => t.userId)])];
    }

    if (targetUserIds.length === 0) {
      console.warn('No user push channels found. Cannot send external notifications.');
      return false;
    }

    // Batch: create all notifications and fetch all push channels up front
    const url = serviceUrlMap[serviceName] ?? '/';
    const now = new Date().toISOString();

    // Create notification records for all users in bulk
    const notifications = await Promise.all(
      targetUserIds.map(userId =>
        prisma.notification.create({
          data: {
            userId,
            title,
            body,
            type: 'external',
            url,
            notificationMetadata: {
              service_name: serviceName,
              event_type: eventType,
              payload: payload.original_payload as Record<string, string | number | boolean | null>,
            },
            read: false,
            createdAt: now,
          },
        }).catch(error => {
          console.error(`Error creating notification for user ${userId}:`, error);
          return null;
        })
      )
    );

    // Build userId -> notification map for created records
    const userNotificationMap = new Map<number, { id: number }>();
    for (let i = 0; i < targetUserIds.length; i++) {
      const notification = notifications[i];
      if (notification) {
        userNotificationMap.set(targetUserIds[i], notification);
      }
    }

    const activeUserIds = [...userNotificationMap.keys()];

    if (activeUserIds.length === 0) {
      console.warn('All notification creates failed, skipping push delivery');
      return false;
    }

    // Fetch all web subscriptions and push tokens in bulk (2 queries instead of 2*N)
    const [allUserSubs, allPushTokens, unreadCounts] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId: { in: activeUserIds } },
      }),
      prisma.pushToken.findMany({
        where: { userId: { in: activeUserIds } },
        select: { token: true, platform: true, userId: true },
      }),
      prisma.notification.groupBy({
        by: ['userId'],
        where: { userId: { in: activeUserIds }, read: false },
        _count: { id: true },
      }),
    ]);

    // Index by userId
    const subsByUser = new Map<number, typeof allUserSubs>();
    for (const sub of allUserSubs) {
      const list = subsByUser.get(sub.userId) || [];
      list.push(sub);
      subsByUser.set(sub.userId, list);
    }

    const tokensByUser = new Map<number, typeof allPushTokens>();
    for (const token of allPushTokens) {
      const list = tokensByUser.get(token.userId) || [];
      list.push(token);
      tokensByUser.set(token.userId, list);
    }

    const unreadByUser = new Map<number, number>();
    for (const entry of unreadCounts) {
      unreadByUser.set(entry.userId, entry._count.id);
    }

    // Send push notifications per user (no more DB queries in this loop)
    let sentCount = 0;
    const allInvalidTokens: string[] = [];

    for (const userId of activeUserIds) {
      const notification = userNotificationMap.get(userId)!;

      // Web Push: browser subscriptions
      const userSubs = subsByUser.get(userId) || [];
      for (const sub of userSubs) {
        try {
          let subscriptionInfo;
          try {
            subscriptionInfo = JSON.parse(sub.subscriptionInfo);
          } catch {
            console.error(`Invalid subscription JSON for subscription ${sub.id}, skipping`);
            continue;
          }
          await sendWebPushNotification(subscriptionInfo, {
            title,
            body,
            tag: `external-${serviceName}-${notification.id}`,
            data: {
              url,
              notification_type: 'external',
              notification_id: notification.id,
            },
          });
        } catch (pushError) {
          console.error(`Error sending push notification to user ${userId}:`, pushError);
        }
      }

      // Mobile Push: APNs
      const pushTokens = tokensByUser.get(userId) || [];
      if (pushTokens.length > 0) {
        const unreadCount = unreadByUser.get(userId) || 0;
        const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);

        if (iosTokens.length > 0) {
          const { successCount, invalidTokens } = await sendApnNotifications(iosTokens, {
            title,
            body,
            data: {
              url,
              notification_type: 'external',
              notification_id: notification.id,
            },
            channelId: 'default',
            badge: unreadCount,
          });

          if (successCount > 0) {
            console.log(`Sent ${successCount} APNs external notifications to user ${userId}`);
          }

          allInvalidTokens.push(...invalidTokens);
        }
      }

      sentCount++;
    }

    // Clean up invalid tokens in a single batch
    if (allInvalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: allInvalidTokens } },
      });
    }

    console.log(`Created ${sentCount} external notifications for ${serviceName}/${eventType}`);
    return true;
  } catch (error) {
    console.error('Error sending external notification:', error);
    return false;
  }
}
