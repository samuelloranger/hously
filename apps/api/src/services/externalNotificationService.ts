import { prisma } from "../db";
import { sendWebPushNotification } from "../utils/webpush";

/**
 * Generate a secure random token for webhook authentication
 */
export function generateServiceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Render a template string by replacing {{variable_name}} with actual values
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  if (!template) return "";

  return template.replace(/\{\{(\w+)\}\}/gi, (match, varName) => {
    const lowerVarName = varName.toLowerCase();
    for (const [key, value] of Object.entries(variables)) {
      if (key.toLowerCase() === lowerVarName) {
        return value ?? "";
      }
    }
    return match; // Keep original if not found
  });
}

/**
 * Get notification template for a specific service, event type, and language
 */
export async function getTemplateForEvent(
  serviceName: string,
  eventType: string,
  language: string = "en"
) {
  // First get the service
  const service = await prisma.externalNotificationService.findFirst({
    where: { serviceName },
  });

  if (!service) {
    console.warn(`Service ${serviceName} not found`);
    return null;
  }

  // Try to find template with exact language
  let template = await prisma.notificationTemplate.findFirst({
    where: {
      serviceId: service.id,
      eventType,
      language,
    },
  });

  // Fallback to English if not found
  if (!template && language !== "en") {
    template = await prisma.notificationTemplate.findFirst({
      where: {
        serviceId: service.id,
        eventType,
        language: "en",
      },
    });
  }

  return template;
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
  },
  language: string = "en"
): Promise<boolean> {
  try {
    // Get template for this event
    const template = await getTemplateForEvent(serviceName, eventType, language);

    if (!template) {
      console.warn(
        `No template found for service=${serviceName}, event=${eventType}, language=${language}`
      );
      return false;
    }

    // Render templates
    const title = renderTemplate(
      template.titleTemplate,
      payload.template_variables
    );
    const body = renderTemplate(
      template.bodyTemplate,
      payload.template_variables
    );

    if (!title || !body) {
      console.error(
        `Rendered template is empty for ${serviceName}/${eventType}`
      );
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
      targetUserIds = adminUsers.map((u) => u.id);

      if (targetUserIds.length === 0) {
        console.warn(
          `No admin users found. Cannot send external notifications for ${serviceName}.`
        );
        return false;
      }
    } else {
      // Get all users with subscriptions
      const allSubscriptions = await prisma.userSubscription.findMany({
        select: { userId: true },
      });
      targetUserIds = [...new Set(allSubscriptions.map((s) => s.userId))];
    }

    if (targetUserIds.length === 0) {
      console.warn(
        "No user subscriptions found. Cannot send external notifications."
      );
      return false;
    }

    // Create notifications and send push notifications for each user
    let sentCount = 0;

    for (const userId of targetUserIds) {
      try {
        // Create notification record
        const notification = await prisma.notification.create({
          data: {
            userId,
            title,
            body,
            type: "external",
            url: "/",
            notificationMetadata: {
              service_name: serviceName,
              event_type: eventType,
              payload: payload.original_payload,
            },
            read: false,
            createdAt: new Date().toISOString(),
          },
        });

        // Get user's subscriptions and send push notifications
        const userSubs = await prisma.userSubscription.findMany({
          where: { userId },
        });

        for (const sub of userSubs) {
          try {
            const subscriptionInfo = JSON.parse(sub.subscriptionInfo);
            await sendWebPushNotification(subscriptionInfo, {
              title,
              body,
              tag: `external-${serviceName}-${notification.id}`,
              data: {
                url: "/",
                notification_type: "external",
                notification_id: notification.id,
              },
            });
          } catch (pushError) {
            console.error(
              `Error sending push notification to user ${userId}:`,
              pushError
            );
          }
        }

        sentCount++;
      } catch (error) {
        console.error(
          `Error creating notification for user ${userId}:`,
          error
        );
      }
    }

    console.log(
      `Created ${sentCount} external notifications for ${serviceName}/${eventType}`
    );
    return true;
  } catch (error) {
    console.error("Error sending external notification:", error);
    return false;
  }
}
