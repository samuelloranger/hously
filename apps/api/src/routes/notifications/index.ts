import { Elysia, t } from "elysia";
import { normalizeNotificationUrl } from "@hously/shared/utils";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getVapidPublicKey,
  sendWebPushNotification,
  type PushSubscription,
} from "@hously/api/utils/webpush";
import { sendApnNotifications } from "@hously/api/utils/apnPush";
import {
  createAndQueueNotification,
  getAllUsers,
} from "@hously/api/workers/notificationService";
import {
  badRequest,
  notFound,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "@hously/api/errors";

const getUnreadCountForUser = async (userId: number): Promise<number> =>
  prisma.notification.count({
    where: { userId, read: false },
  });

const syncBadgesForUser = async (
  userId: number,
  unreadCount: number,
  readNotificationIds?: number[],
): Promise<void> => {
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true, platform: true },
  });

  if (pushTokens.length === 0) {
    return;
  }

  const iosTokens = pushTokens
    .filter((t) => t.platform === "ios")
    .map((t) => t.token);

  if (iosTokens.length > 0) {
    const data: Record<string, unknown> = {
      notification_type: "badge-sync",
      unread_count: unreadCount,
      silent: true,
    };

    if (readNotificationIds && readNotificationIds.length > 0) {
      data.read_notification_ids = readNotificationIds;
    }

    console.log(
      `[syncBadges] Sending badge-sync to ${iosTokens.length} iOS device(s) — badge=${unreadCount}, readIds=${readNotificationIds?.join(",") ?? "none"}`,
    );

    const { invalidTokens } = await sendApnNotifications(iosTokens, {
      data,
      sound: null,
      badge: unreadCount,
      contentAvailable: true,
    });

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
    }
  }
};

export const notificationsRoutes = new Elysia({ prefix: "/api/notifications" })
  .use(auth)
  // GET /api/notifications - Get notifications with pagination
  .get(
    "/",
    async ({ user, query, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? 20, 100);
      const readFilter = query.read;

      try {
        // Build where conditions
        const where: any = { userId: user.id };

        if (readFilter === "true") {
          where.read = true;
        } else if (readFilter === "false") {
          where.read = false;
        }

        // Get total count
        const total = await prisma.notification.count({ where });

        // Get paginated notifications
        const notificationsList = await prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
        });

        return {
          notifications: notificationsList.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.type,
            read: n.read,
            read_at: n.readAt,
            url: normalizeNotificationUrl(n.url),
            metadata: n.notificationMetadata,
            created_at: n.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Error getting notifications:", error);
        return serverError(set, "Failed to get notifications");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        read: t.Optional(t.String()),
      }),
    },
  )
  // GET /api/notifications/unread-count - Get unread count
  .get("/unread-count", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    try {
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      });

      return { unread_count: count };
    } catch (error) {
      console.error("Error getting unread count:", error);
      return serverError(set, "Failed to get unread count");
    }
  })
  // GET /api/notifications/unread-ids - Lightweight endpoint for the SW to check read status
  // Returns only the IDs of unread notifications so the SW can skip showing already-read ones.
  .get("/unread-ids", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    try {
      const unread = await prisma.notification.findMany({
        where: { userId: user.id, read: false },
        select: { id: true },
      });

      return { ids: unread.map((n) => n.id) };
    } catch (error) {
      console.error("Error getting unread notification IDs:", error);
      return serverError(set, "Failed to get unread IDs");
    }
  })
  // PUT /api/notifications/:id/read - Mark notification as read
  .put("/:id/read", async ({ user, params, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      return badRequest(set, "Invalid notification ID");
    }

    try {
      // Check if notification exists and belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: user.id,
        },
      });

      if (!notification) {
        return notFound(set, "Notification not found");
      }

      if (!notification.read) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            read: true,
            readAt: new Date().toISOString(),
          },
        });

        const unreadCount = await getUnreadCountForUser(user.id);
        await syncBadgesForUser(user.id, unreadCount, [notificationId]);
      }

      return { success: true, message: "Notification marked as read" };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return serverError(set, "Failed to mark notification as read");
    }
  })
  // PUT /api/notifications/read-all - Mark all notifications as read
  .put("/read-all", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    try {
      // Get IDs of unread notifications before marking them
      const unreadNotifications = await prisma.notification.findMany({
        where: { userId: user.id, read: false },
        select: { id: true },
      });
      const readIds = unreadNotifications.map((n) => n.id);

      const result = await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: {
          read: true,
          readAt: new Date().toISOString(),
        },
      });

      const count = result.count;

      await syncBadgesForUser(user.id, 0, readIds);

      return {
        success: true,
        message: `Marked ${count} notifications as read`,
        count,
      };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return serverError(set, "Failed to mark all notifications as read");
    }
  })
  // DELETE /api/notifications/:id - Delete notification
  .delete("/:id", async ({ user, params, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      return badRequest(set, "Invalid notification ID");
    }

    try {
      // Check if notification exists and belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: user.id,
        },
      });

      if (!notification) {
        return notFound(set, "Notification not found");
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      // Always sync badges and remove from lock screen (even if already read)
      const unreadCount = await getUnreadCountForUser(user.id);
      await syncBadgesForUser(user.id, unreadCount, [notificationId]);

      return { success: true, message: "Notification deleted" };
    } catch (error) {
      console.error("Error deleting notification:", error);
      return serverError(set, "Failed to delete notification");
    }
  })
  // GET /api/notifications/devices - Get user's notification devices
  .get("/devices", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    try {
      const devices = await prisma.userSubscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        devices: devices.map((d) => ({
          id: d.id,
          endpoint: d.endpoint,
          device_name: d.deviceName,
          os_name: d.osName,
          os_version: d.osVersion,
          browser_name: d.browserName,
          browser_version: d.browserVersion,
          platform: d.platform,
          created_at: d.createdAt,
          updated_at: d.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Error getting devices:", error);
      return serverError(set, "Failed to get devices");
    }
  })
  // DELETE /api/notifications/devices/:id - Delete notification device
  .delete("/devices/:id", async ({ user, params, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    const deviceId = parseInt(params.id, 10);

    try {
      // Check if device exists and belongs to user
      const device = await prisma.userSubscription.findFirst({
        where: {
          id: deviceId,
          userId: user.id,
        },
      });

      if (!device) {
        return notFound(set, "Device not found");
      }

      await prisma.userSubscription.delete({
        where: { id: deviceId },
      });

      return { success: true, message: "Device deleted successfully" };
    } catch (error) {
      console.error("Error deleting device:", error);
      return serverError(set, "Failed to delete device");
    }
  })
  // GET /api/notifications/vapid-public-key - Get VAPID public key for push notifications
  .get("/vapid-public-key", ({ set }) => {
    try {
      const publicKey = getVapidPublicKey();
      return { publicKey };
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      return serviceUnavailable(
        set,
        "VAPID keys not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.",
      );
    }
  })
  // POST /api/notifications/subscribe - Subscribe to push notifications
  .post(
    "/subscribe",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { subscription, device_info } = body;

      if (!subscription || !subscription.endpoint) {
        return badRequest(set, "Subscription data is required");
      }

      try {
        const endpoint = subscription.endpoint;
        const deviceName = device_info?.deviceName || null;
        const osName = device_info?.osName || "Unknown";
        const osVersion = device_info?.osVersion || null;
        const browserName = device_info?.browserName || "Unknown";
        const browserVersion = device_info?.browserVersion || null;
        const platform = device_info?.platform || null;

        // Check if subscription already exists for this user
        const existingSubscription = await prisma.userSubscription.findFirst({
          where: {
            userId: user.id,
            endpoint,
          },
        });

        const now = new Date().toISOString();
        let isNewSubscription = false;

        if (existingSubscription) {
          // Update existing subscription
          await prisma.userSubscription.update({
            where: { id: existingSubscription.id },
            data: {
              subscriptionInfo: JSON.stringify(subscription),
              updatedAt: now,
              deviceName,
              osName,
              osVersion,
              browserName,
              browserVersion,
              platform,
            },
          });

          console.log(`User ${user.id} updated existing subscription`);
        } else {
          // Create new subscription
          await prisma.userSubscription.create({
            data: {
              userId: user.id,
              subscriptionInfo: JSON.stringify(subscription),
              endpoint,
              deviceName,
              osName,
              osVersion,
              browserName,
              browserVersion,
              platform,
              createdAt: now,
              updatedAt: now,
            },
          });

          isNewSubscription = true;
          console.log(
            `User ${user.id} added new push notification subscription`,
          );
        }

        // Send welcome notification for new subscriptions
        if (isNewSubscription) {
          try {
            await sendWebPushNotification(subscription as PushSubscription, {
              title: "Notifications enabled!",
              body: "You will now receive notifications for your tasks, bills and reminders.",
              data: { url: "/settings?tab=notifications" },
              tag: "welcome-notification",
            });
            console.log(`Welcome notification sent to user ${user.id}`);
          } catch (welcomeError) {
            console.warn(
              `Failed to send welcome notification to user ${user.id}:`,
              welcomeError,
            );
          }
        }

        return { success: true, message: "Subscription saved successfully" };
      } catch (error) {
        console.error("Error subscribing to notifications:", error);
        return serverError(set, "Failed to subscribe");
      }
    },
    {
      body: t.Object({
        subscription: t.Object({
          endpoint: t.String(),
          keys: t.Object({
            p256dh: t.String(),
            auth: t.String(),
          }),
        }),
        device_info: t.Optional(
          t.Object({
            deviceName: t.Optional(t.Nullable(t.String())),
            osName: t.Optional(t.Nullable(t.String())),
            osVersion: t.Optional(t.Nullable(t.String())),
            browserName: t.Optional(t.Nullable(t.String())),
            browserVersion: t.Optional(t.Nullable(t.String())),
            platform: t.Optional(t.Nullable(t.String())),
          }),
        ),
      }),
    },
  )
  // POST /api/notifications/unsubscribe - Unsubscribe from push notifications
  .post(
    "/unsubscribe",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      try {
        const subscription = body?.subscription;

        if (subscription && subscription.endpoint) {
          // Unsubscribe specific device by endpoint
          await prisma.userSubscription.deleteMany({
            where: {
              userId: user.id,
              endpoint: subscription.endpoint,
            },
          });
          console.log(
            `User ${user.id} unsubscribed device: ${subscription.endpoint.slice(0, 50)}...`,
          );
        } else {
          // No endpoint provided - do nothing rather than deleting all subscriptions.
          // iOS push tokens should use /unregister-device instead.
          console.log(
            `User ${user.id} called unsubscribe without endpoint - skipping`,
          );
          return {
            success: true,
            message: "No endpoint provided, nothing to unsubscribe",
          };
        }

        return { success: true, message: "Unsubscribed successfully" };
      } catch (error) {
        console.error("Error unsubscribing from notifications:", error);
        return serverError(set, "Failed to unsubscribe");
      }
    },
    {
      body: t.Optional(
        t.Object({
          subscription: t.Optional(
            t.Object({
              endpoint: t.String(),
            }),
          ),
        }),
      ),
    },
  )
  // POST /api/notifications/test - Send a test push notification
  .post(
    "/test",
    async ({ user, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      if (!user.is_admin) {
        return unauthorized(set, "Unauthorized");
      }

      try {
        const users = await getAllUsers();
        let totalSent = 0;

        for (const targetUser of users) {
          const success = await createAndQueueNotification(
            targetUser.id,
            "Test notification",
            "If you see this, notifications are working! 🎉",
            "test",
            "/settings?tab=notifications",
          );
          if (success) {
            totalSent++;
          }
        }

        if (totalSent > 0) {
          return {
            success: true,
            message: `Test notifications sent to ${totalSent} users`,
          };
        } else {
          return badRequest(
            set,
            "No valid push subscriptions or tokens found in the system.",
          );
        }
      } catch (error) {
        console.error("Error sending test notification:", error);
        return serverError(set, "Failed to send test notification");
      }
    },
    {
      body: t.Optional(
        t.Object({
          subscription: t.Optional(
            t.Object({
              endpoint: t.String(),
              keys: t.Object({
                p256dh: t.String(),
                auth: t.String(),
              }),
            }),
          ),
        }),
      ),
    },
  )
  // POST /api/notifications/register-device - Register mobile push token (Expo/APNs/FCM)
  .post(
    "/register-device",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { token, platform } = body;

      if (!token || !platform) {
        return badRequest(set, "Token and platform are required");
      }

      try {
        const now = new Date().toISOString();

        // Check if this token is already registered
        const existing = await prisma.pushToken.findFirst({
          where: { token },
        });

        if (existing) {
          // Update: reassign to current user if needed, refresh timestamp
          await prisma.pushToken.update({
            where: { id: existing.id },
            data: {
              userId: user.id,
              platform,
              updatedAt: now,
            },
          });

          console.log(`Push token updated for user ${user.id} (${platform})`);
        } else {
          // Insert new push token
          await prisma.pushToken.create({
            data: {
              userId: user.id,
              token,
              platform,
              createdAt: now,
              updatedAt: now,
            },
          });

          console.log(
            `Push token registered for user ${user.id} (${platform})`,
          );
        }

        return { success: true, message: "Device registered successfully" };
      } catch (error) {
        console.error("Error registering push token:", error);
        return serverError(set, "Failed to register device");
      }
    },
    {
      body: t.Object({
        token: t.String(),
        platform: t.String(),
      }),
    },
  )
  // POST /api/notifications/unregister-device - Unregister a mobile push token
  .post(
    "/unregister-device",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { token } = body;

      if (!token) {
        return badRequest(set, "Token is required");
      }

      try {
        const deleted = await prisma.pushToken.deleteMany({
          where: {
            userId: user.id,
            token,
          },
        });

        if (deleted.count === 0) {
          console.log(`No push token found to unregister for user ${user.id}`);
        } else {
          console.log(`Push token unregistered for user ${user.id}`);
        }

        return { success: true, message: "Device unregistered successfully" };
      } catch (error) {
        console.error("Error unregistering push token:", error);
        return serverError(set, "Failed to unregister device");
      }
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    },
  );
