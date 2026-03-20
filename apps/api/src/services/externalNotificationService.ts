import { prisma } from '../db';
import { createAndQueueNotification } from '../jobs/notificationService';
import { getExternalNotificationUrl } from '@hously/shared';
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
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId, platform: 'ios' },
    select: { token: true },
  });

  const iosTokens = [...new Set(pushTokens.map(t => t.token).filter(Boolean))];
  if (iosTokens.length === 0) {
    return false;
  }

  const { successCount, invalidTokens } = await sendApnNotifications(iosTokens, {
    contentAvailable: true,
    sound: null,
    data: {
      type,
      notification_type: type,
      silent: true,
    },
  });

  if (invalidTokens.length > 0) {
    await prisma.pushToken.deleteMany({
      where: { token: { in: invalidTokens } },
    });
  }

  return successCount > 0;
}

/**
 * Send external notification to all subscribed users
 */
export async function sendExternalNotification(
  serviceName: string,
  eventType: string,
  payload: {
    template_variables: Record<string, string>;
    original_payload: Record<string, unknown>;
    notification_url?: string;
    notification_metadata?: Record<string, unknown>;
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
      // Get all users with at least one delivery channel
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

    const url = payload.notification_url || getExternalNotificationUrl(serviceName);

    // Enqueue notifications for all target users
    console.log(`[ExternalNotificationService] Enqueuing ${targetUserIds.length} notifications for ${serviceName}/${eventType}`);
    
    const results = await Promise.all(
      targetUserIds.map(userId => 
        createAndQueueNotification(
          userId,
          title,
          body,
          'external',
          url,
          {
            service_name: serviceName,
            event_type: eventType,
            payload: payload.original_payload as Record<string, any>,
            ...(payload.notification_metadata ?? {}),
          }
        )
      )
    );

    const successCount = results.filter(Boolean).length;
    console.log(`[ExternalNotificationService] Successfully enqueued ${successCount}/${targetUserIds.length} notifications.`);

    return successCount > 0;
  } catch (error) {
    console.error('Error sending external notification:', error);
    return false;
  }
}
