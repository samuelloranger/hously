import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { getVapidPublicKey, sendWebPushNotification, type PushSubscription } from '../utils/webpush';
import { sendExpoPushNotifications } from '../utils/expoPush';
import { sendApnNotifications } from '../utils/apnPush';

const getUnreadCountForUser = async (userId: number): Promise<number> =>
  prisma.notification.count({
    where: { userId, read: false },
  });

const syncBadgesForUser = async (userId: number, unreadCount: number): Promise<void> => {
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true, platform: true },
  });

  if (pushTokens.length === 0) {
    return;
  }

  const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);
  const expoTokens = pushTokens.filter(t => t.platform !== 'ios').map(t => t.token);

  if (expoTokens.length > 0) {
    const { invalidTokens } = await sendExpoPushNotifications(
      expoTokens,
      {
        data: {
          notification_type: 'badge-sync',
          unread_count: unreadCount,
          silent: true,
        },
        sound: null,
        badge: unreadCount,
        contentAvailable: true,
      }
    );

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
    }
  }

  if (iosTokens.length > 0) {
    const { invalidTokens } = await sendApnNotifications(
      iosTokens,
      {
        data: {
          notification_type: 'badge-sync',
          unread_count: unreadCount,
          silent: true,
        },
        sound: null,
        badge: unreadCount,
        contentAvailable: true,
      }
    );

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
    }
  }
};

export const notificationsRoutes = new Elysia({ prefix: '/api/notifications' })
  .use(auth)
  // GET /api/notifications - Get notifications with pagination
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? 20, 100);
      const readFilter = query.read;

      try {
        // Build where conditions
        const where: any = { userId: user.id };

        if (readFilter === 'true') {
          where.read = true;
        } else if (readFilter === 'false') {
          where.read = false;
        }

        // Get total count
        const total = await prisma.notification.count({ where });

        // Get paginated notifications
        const notificationsList = await prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
        });

        return {
          notifications: notificationsList.map(n => ({
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
        console.error('Error getting notifications:', error);
        set.status = 500;
        return { error: 'Failed to get notifications' };
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
  .get('/unread-count', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      });

      return { unread_count: count };
    } catch (error) {
      console.error('Error getting unread count:', error);
      set.status = 500;
      return { error: 'Failed to get unread count' };
    }
  })
  // PUT /api/notifications/:id/read - Mark notification as read
  .put('/:id/read', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      set.status = 400;
      return { error: 'Invalid notification ID' };
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
        set.status = 404;
        return { error: 'Notification not found' };
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
        await syncBadgesForUser(user.id, unreadCount);
      }

      return { success: true, message: 'Notification marked as read' };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      set.status = 500;
      return { error: 'Failed to mark notification as read' };
    }
  })
  // PUT /api/notifications/read-all - Mark all notifications as read
  .put('/read-all', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const result = await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: {
          read: true,
          readAt: new Date().toISOString(),
        },
      });

      const count = result.count;

      await syncBadgesForUser(user.id, 0);

      return {
        success: true,
        message: `Marked ${count} notifications as read`,
        count,
      };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      set.status = 500;
      return { error: 'Failed to mark all notifications as read' };
    }
  })
  // DELETE /api/notifications/:id - Delete notification
  .delete('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      set.status = 400;
      return { error: 'Invalid notification ID' };
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
        set.status = 404;
        return { error: 'Notification not found' };
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      if (!notification.read) {
        const unreadCount = await getUnreadCountForUser(user.id);
        await syncBadgesForUser(user.id, unreadCount);
      }

      return { success: true, message: 'Notification deleted' };
    } catch (error) {
      console.error('Error deleting notification:', error);
      set.status = 500;
      return { error: 'Failed to delete notification' };
    }
  })
  // GET /api/notifications/devices - Get user's notification devices
  .get('/devices', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const devices = await prisma.userSubscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      return {
        devices: devices.map(d => ({
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
      console.error('Error getting devices:', error);
      set.status = 500;
      return { error: 'Failed to get devices' };
    }
  })
  // DELETE /api/notifications/devices/:id - Delete notification device
  .delete('/devices/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
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
        set.status = 404;
        return { error: 'Device not found' };
      }

      await prisma.userSubscription.delete({
        where: { id: deviceId },
      });

      return { success: true, message: 'Device deleted successfully' };
    } catch (error) {
      console.error('Error deleting device:', error);
      set.status = 500;
      return { error: 'Failed to delete device' };
    }
  })
  // GET /api/notifications/vapid-public-key - Get VAPID public key for push notifications
  .get('/vapid-public-key', ({ set }) => {
    try {
      const publicKey = getVapidPublicKey();
      return { publicKey };
    } catch (error) {
      console.error('Error getting VAPID public key:', error);
      set.status = 503;
      return {
        error: 'VAPID keys not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.',
      };
    }
  })
  // POST /api/notifications/subscribe - Subscribe to push notifications
  .post(
    '/subscribe',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { subscription, device_info } = body;

      if (!subscription || !subscription.endpoint) {
        set.status = 400;
        return { error: 'Subscription data is required' };
      }

      try {
        const endpoint = subscription.endpoint;
        const deviceName = device_info?.deviceName || null;
        const osName = device_info?.osName || 'Unknown';
        const osVersion = device_info?.osVersion || null;
        const browserName = device_info?.browserName || 'Unknown';
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
          console.log(`User ${user.id} added new push notification subscription`);
        }

        // Send welcome notification for new subscriptions
        if (isNewSubscription) {
          try {
            await sendWebPushNotification(subscription as PushSubscription, {
              title: 'Notifications enabled!',
              body: 'You will now receive notifications for your tasks, bills and reminders.',
              data: { url: '/settings?tab=notifications' },
              tag: 'welcome-notification',
            });
            console.log(`Welcome notification sent to user ${user.id}`);
          } catch (welcomeError) {
            console.warn(`Failed to send welcome notification to user ${user.id}:`, welcomeError);
          }
        }

        return { success: true, message: 'Subscription saved successfully' };
      } catch (error) {
        console.error('Error subscribing to notifications:', error);
        set.status = 500;
        return { error: 'Failed to subscribe' };
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
    '/unsubscribe',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
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
          console.log(`User ${user.id} unsubscribed device: ${subscription.endpoint.slice(0, 50)}...`);
        } else {
          // Unsubscribe all devices for this user
          await prisma.userSubscription.deleteMany({
            where: { userId: user.id },
          });
          console.log(`User ${user.id} unsubscribed all devices`);
        }

        return { success: true, message: 'Unsubscribed successfully' };
      } catch (error) {
        console.error('Error unsubscribing from notifications:', error);
        set.status = 500;
        return { error: 'Failed to unsubscribe' };
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
    '/test',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { subscription } = body;

      try {
        let webPushSuccess = false;
        let expoPushSuccess = false;
        let totalSent = 0;

        // Send to web push subscription if provided
        if (subscription) {
          const result = await sendWebPushNotification(subscription as PushSubscription, {
            title: 'Test notification',
            body: 'If you see this, notifications are working! 🎉',
            data: { url: '/settings?tab=notifications' },
            tag: 'test-notification',
          });

          if (result.success) {
            webPushSuccess = true;
            totalSent++;
            console.log(`Test web push notification sent to user ${user.id}`);
          } else if (result.expired) {
            console.log(`Web push subscription expired for user ${user.id}`);
          } else {
            console.error(`Web push failed for user ${user.id}:`, result.error);
          }
        }

        // Send to Expo & APNs push tokens (mobile)
        const pushTokens = await prisma.pushToken.findMany({
          where: { userId: user.id },
          select: { token: true, platform: true },
        });

        if (pushTokens.length > 0) {
          const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);
          const expoTokens = pushTokens.filter(t => t.platform !== 'ios').map(t => t.token);
          const unreadCount = await prisma.notification.count({
            where: { userId: user.id, read: false },
          });

          if (expoTokens.length > 0) {
            const { successCount, invalidTokens } = await sendExpoPushNotifications(
              expoTokens,
              {
                title: 'Test notification',
                body: 'If you see this, notifications are working! 🎉',
                data: { url: '/settings?tab=notifications' },
                channelId: 'default',
                badge: unreadCount,
              }
            );

            if (successCount > 0) {
              expoPushSuccess = true;
              totalSent += successCount;
              console.log(`Test Expo push notifications sent to user ${user.id}: ${successCount}`);
            }

            if (invalidTokens.length > 0) {
              await prisma.pushToken.deleteMany({
                where: { token: { in: invalidTokens } },
              });
              console.log(`Deleted ${invalidTokens.length} invalid Expo tokens for user ${user.id}`);
            }
          }

          if (iosTokens.length > 0) {
            const { successCount, invalidTokens } = await sendApnNotifications(
              iosTokens,
              {
                title: 'Test notification',
                body: 'If you see this, notifications are working! 🎉',
                data: { url: '/settings?tab=notifications' },
                channelId: 'default',
                badge: unreadCount,
              }
            );

            if (successCount > 0) {
              expoPushSuccess = true; // reusing existing var or could rename to mobilePushSuccess
              totalSent += successCount;
              console.log(`Test APNs push notifications sent to user ${user.id}: ${successCount}`);
            }

            if (invalidTokens.length > 0) {
              await prisma.pushToken.deleteMany({
                where: { token: { in: invalidTokens } },
              });
              console.log(`Deleted ${invalidTokens.length} invalid APNs tokens for user ${user.id}`);
            }
          }
        }

        if (totalSent > 0) {
          return {
            success: true,
            message: `Test notification sent to ${totalSent} device(s)`,
            webPush: webPushSuccess,
            mobilePush: expoPushSuccess,
          };
        } else {
          set.status = 400;
          return { error: 'No valid push subscriptions or tokens found. Please register a device first.' };
        }
      } catch (error) {
        console.error('Error sending test notification:', error);
        set.status = 500;
        return { error: 'Failed to send test notification' };
      }
    },
    {
      body: t.Object({
        subscription: t.Optional(
          t.Object({
            endpoint: t.String(),
            keys: t.Object({
              p256dh: t.String(),
              auth: t.String(),
            }),
          })
        ),
      }),
    }
  )
  // POST /api/notifications/register-device - Register mobile push token (Expo/APNs/FCM)
  .post(
    '/register-device',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { token, platform } = body;

      if (!token || !platform) {
        set.status = 400;
        return { error: 'Token and platform are required' };
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

          console.log(`Push token registered for user ${user.id} (${platform})`);
        }

        return { success: true, message: 'Device registered successfully' };
      } catch (error) {
        console.error('Error registering push token:', error);
        set.status = 500;
        return { error: 'Failed to register device' };
      }
    },
    {
      body: t.Object({
        token: t.String(),
        platform: t.String(),
      }),
    }
  );
