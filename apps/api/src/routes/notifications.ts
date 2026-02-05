import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { db } from "../db";
import { notifications, userSubscriptions } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  getVapidPublicKey,
  sendWebPushNotification,
  type PushSubscription,
} from "../utils/webpush";

export const notificationsRoutes = new Elysia({ prefix: "/api/notifications" })
  .use(auth)
  // GET /api/notifications - Get notifications with pagination
  .get(
    "/",
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? 20, 100);
      const readFilter = query.read;

      try {
        // Build where conditions
        const conditions = [eq(notifications.userId, user.id)];

        if (readFilter === "true") {
          conditions.push(eq(notifications.read, true));
        } else if (readFilter === "false") {
          conditions.push(eq(notifications.read, false));
        }

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(and(...conditions));
        const total = Number(countResult[0]?.count ?? 0);

        // Get paginated notifications
        const notificationsList = await db
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset((page - 1) * limit);

        return {
          notifications: notificationsList.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.type,
            read: n.read,
            read_at: n.readAt,
            url: n.url,
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
        set.status = 500;
        return { error: "Failed to get notifications" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        read: t.Optional(t.String()),
      }),
    }
  )
  // GET /api/notifications/unread-count - Get unread count
  .get("/unread-count", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), eq(notifications.read, false))
        );

      return { unread_count: Number(result[0]?.count ?? 0) };
    } catch (error) {
      console.error("Error getting unread count:", error);
      set.status = 500;
      return { error: "Failed to get unread count" };
    }
  })
  // PUT /api/notifications/:id/read - Mark notification as read
  .put("/:id/read", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      set.status = 400;
      return { error: "Invalid notification ID" };
    }

    try {
      // Check if notification exists and belongs to user
      const notification = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        ),
      });

      if (!notification) {
        set.status = 404;
        return { error: "Notification not found" };
      }

      if (!notification.read) {
        await db
          .update(notifications)
          .set({
            read: true,
            readAt: new Date().toISOString(),
          })
          .where(eq(notifications.id, notificationId));
      }

      return { success: true, message: "Notification marked as read" };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      set.status = 500;
      return { error: "Failed to mark notification as read" };
    }
  })
  // PUT /api/notifications/read-all - Mark all notifications as read
  .put("/read-all", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const result = await db
        .update(notifications)
        .set({
          read: true,
          readAt: new Date().toISOString(),
        })
        .where(
          and(eq(notifications.userId, user.id), eq(notifications.read, false))
        );

      const count = result.rowCount ?? 0;

      return {
        success: true,
        message: `Marked ${count} notifications as read`,
        count,
      };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      set.status = 500;
      return { error: "Failed to mark all notifications as read" };
    }
  })
  // DELETE /api/notifications/:id - Delete notification
  .delete("/:id", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      set.status = 400;
      return { error: "Invalid notification ID" };
    }

    try {
      // Check if notification exists and belongs to user
      const notification = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        ),
      });

      if (!notification) {
        set.status = 404;
        return { error: "Notification not found" };
      }

      await db
        .delete(notifications)
        .where(eq(notifications.id, notificationId));

      return { success: true, message: "Notification deleted" };
    } catch (error) {
      console.error("Error deleting notification:", error);
      set.status = 500;
      return { error: "Failed to delete notification" };
    }
  })
  // GET /api/notifications/devices - Get user's notification devices
  .get("/devices", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const devices = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, user.id))
        .orderBy(desc(userSubscriptions.createdAt));

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
      set.status = 500;
      return { error: "Failed to get devices" };
    }
  })
  // DELETE /api/notifications/devices/:id - Delete notification device
  .delete("/devices/:id", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const deviceId = parseInt(params.id, 10);

    try {
      // Check if device exists and belongs to user
      const device = await db.query.userSubscriptions.findFirst({
        where: and(
          eq(userSubscriptions.id, deviceId),
          eq(userSubscriptions.userId, user.id)
        ),
      });

      if (!device) {
        set.status = 404;
        return { error: "Device not found" };
      }

      await db.delete(userSubscriptions).where(eq(userSubscriptions.id, deviceId));

      return { success: true, message: "Device deleted successfully" };
    } catch (error) {
      console.error("Error deleting device:", error);
      set.status = 500;
      return { error: "Failed to delete device" };
    }
  })
  // GET /api/notifications/vapid-public-key - Get VAPID public key for push notifications
  .get("/vapid-public-key", ({ set }) => {
    try {
      const publicKey = getVapidPublicKey();
      return { publicKey };
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      set.status = 503;
      return {
        error:
          "VAPID keys not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.",
      };
    }
  })
  // POST /api/notifications/subscribe - Subscribe to push notifications
  .post(
    "/subscribe",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { subscription, device_info } = body;

      if (!subscription || !subscription.endpoint) {
        set.status = 400;
        return { error: "Subscription data is required" };
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
        const existingSubscription = await db.query.userSubscriptions.findFirst(
          {
            where: and(
              eq(userSubscriptions.userId, user.id),
              eq(userSubscriptions.endpoint, endpoint)
            ),
          }
        );

        const now = new Date().toISOString();
        let isNewSubscription = false;

        if (existingSubscription) {
          // Update existing subscription
          await db
            .update(userSubscriptions)
            .set({
              subscriptionInfo: JSON.stringify(subscription),
              updatedAt: now,
              deviceName,
              osName,
              osVersion,
              browserName,
              browserVersion,
              platform,
            })
            .where(eq(userSubscriptions.id, existingSubscription.id));

          console.log(`User ${user.id} updated existing subscription`);
        } else {
          // Create new subscription
          await db.insert(userSubscriptions).values({
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
          });

          isNewSubscription = true;
          console.log(`User ${user.id} added new push notification subscription`);
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
              welcomeError
            );
          }
        }

        return { success: true, message: "Subscription saved successfully" };
      } catch (error) {
        console.error("Error subscribing to notifications:", error);
        set.status = 500;
        return { error: "Failed to subscribe" };
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
            deviceName: t.Optional(t.String()),
            osName: t.Optional(t.String()),
            osVersion: t.Optional(t.String()),
            browserName: t.Optional(t.String()),
            browserVersion: t.Optional(t.String()),
            platform: t.Optional(t.String()),
          })
        ),
      }),
    }
  )
  // POST /api/notifications/unsubscribe - Unsubscribe from push notifications
  .post(
    "/unsubscribe",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const subscription = body?.subscription;

        if (subscription && subscription.endpoint) {
          // Unsubscribe specific device by endpoint
          await db
            .delete(userSubscriptions)
            .where(
              and(
                eq(userSubscriptions.userId, user.id),
                eq(userSubscriptions.endpoint, subscription.endpoint)
              )
            );
          console.log(
            `User ${user.id} unsubscribed device: ${subscription.endpoint.slice(0, 50)}...`
          );
        } else {
          // Unsubscribe all devices for this user
          await db
            .delete(userSubscriptions)
            .where(eq(userSubscriptions.userId, user.id));
          console.log(`User ${user.id} unsubscribed all devices`);
        }

        return { success: true, message: "Unsubscribed successfully" };
      } catch (error) {
        console.error("Error unsubscribing from notifications:", error);
        set.status = 500;
        return { error: "Failed to unsubscribe" };
      }
    },
    {
      body: t.Optional(
        t.Object({
          subscription: t.Optional(
            t.Object({
              endpoint: t.String(),
            })
          ),
        })
      ),
    }
  )
  // POST /api/notifications/test - Send a test push notification
  .post(
    "/test",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { subscription } = body;

      if (!subscription) {
        set.status = 400;
        return { error: "Subscription data is required" };
      }

      try {
        const result = await sendWebPushNotification(
          subscription as PushSubscription,
          {
            title: "Test notification",
            body: "If you see this, notifications are working! 🎉",
            data: { url: "/settings?tab=notifications" },
            tag: "test-notification",
          }
        );

        if (result.success) {
          console.log(`Test notification sent to user ${user.id}`);
          return { success: true, message: "Test notification sent" };
        } else if (result.expired) {
          set.status = 410;
          return { error: "Subscription expired. Please subscribe again." };
        } else {
          set.status = 500;
          return { error: result.error || "Failed to send test notification" };
        }
      } catch (error) {
        console.error("Error sending test notification:", error);
        set.status = 500;
        return { error: "Failed to send test notification" };
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
      }),
    }
  );
