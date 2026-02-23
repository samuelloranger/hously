/**
 * Version service for checking app version changes and notifying users
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../db';
import { sendWebPushNotification, type PushSubscription } from '../utils/webpush';
import { sendApnNotifications } from '../utils/apnPush';
import { logActivity } from '../utils/activityLogs';
import { getJsonCache, setJsonCache } from './cache';
import { sendExternalNotification } from './externalNotificationService';

const PACKAGE_VERSION = '1.0.0';
const APP_VERSION_KEY = 'hously:app_version';

function getCurrentAppVersion(): string {
  try {
    const versionFromFile = readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8');
    const pkg = JSON.parse(versionFromFile);
    return pkg.version || PACKAGE_VERSION;
  } catch {
    return PACKAGE_VERSION;
  }
}

function getGitCommitHash(): string | null {
  try {
    const headPath = resolve(process.cwd(), '.git/HEAD');
    if (!existsSync(headPath)) return null;

    const head = readFileSync(headPath, 'utf-8').trim();
    if (head.startsWith('ref:')) {
      const refPath = resolve(process.cwd(), '.git', head.substring(5));
      if (existsSync(refPath)) {
        return readFileSync(refPath, 'utf-8').trim().substring(0, 7);
      }
    }
    return head.substring(0, 7);
  } catch {
    return null;
  }
}

export function getAppVersion(): string {
  const pkgVersion = getCurrentAppVersion();
  const gitHash = getGitCommitHash();

  if (gitHash) {
    return `${pkgVersion}-${gitHash}`;
  }
  return pkgVersion;
}

async function getStoredAppVersion(): Promise<string | null> {
  return await getJsonCache<string>(APP_VERSION_KEY);
}

async function storeAppVersion(version: string): Promise<void> {
  // Store with a very long TTL (e.g., 1 year) as this is semi-permanent state
  await setJsonCache(APP_VERSION_KEY, version, 365 * 24 * 60 * 60);
  console.log(`Stored app version in Redis: ${version}`);
}

export async function sendAppUpdateNotifications(newVersion?: string): Promise<void> {
  try {
    const version = newVersion || getAppVersion();

    // 1. Send "External" notification via the notification service if configured
    try {
      await sendExternalNotification(
        'hously',
        'AppUpdate',
        {
          template_variables: {
            version,
            message: `Hously has been updated to version ${version}`,
            environment: process.env.NODE_ENV || 'production'
          },
          original_payload: {
            version,
            event: 'AppUpdate',
            timestamp: new Date().toISOString()
          }
        },
        'en'
      );
    } catch (err) {
      console.warn('Failed to send external hously notification:', err);
    }

    // 2. Standard internal notifications (Web Push, Expo Push)
    const userIds = await prisma.userSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });

    if (userIds.length === 0) {
      console.log('No users with subscriptions found for app update notification');
      return;
    }

    console.log(`Sending app update notifications for version ${version} to ${userIds.length} users`);

    for (const { userId } of userIds) {
      try {
        const notification = await prisma.notification.create({
          data: {
            userId,
            title: 'App Updated',
            body: `Hously has been updated to version ${version}`,
            type: 'app-update',
            url: '/',
            notificationMetadata: { version, silent: true },
            read: false,
            createdAt: new Date().toISOString(),
          },
        });

        const subscriptions = await prisma.userSubscription.findMany({
          where: { userId },
        });

        for (const sub of subscriptions) {
          try {
            const subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;
            await sendWebPushNotification(subscriptionInfo, {
              title: 'App Updated',
              body: `Hously has been updated to version ${version}`,
              tag: 'app-update',
              data: {
                url: '/',
                notification_type: 'app-update',
                notification_id: notification.id,
                version,
                silent: true,
              },
            });
          } catch (error) {
            console.error(`Error sending push to subscription ${sub.id}:`, error);
          }
        }

        const pushTokens = await prisma.pushToken.findMany({
          where: { userId },
          select: { token: true, platform: true },
        });

        if (pushTokens.length > 0) {
          const iosTokens = pushTokens.filter(t => t.platform === 'ios').map(t => t.token);
          const unreadCount = await prisma.notification.count({
            where: { userId, read: false },
          });

          if (iosTokens.length > 0) {
            await sendApnNotifications(iosTokens, {
              title: 'App Updated',
              body: `Hously has been updated to version ${version}`,
              data: {
                url: '/',
                notification_type: 'app-update',
                notification_id: notification.id,
                version,
                silent: true,
              },
              channelId: 'default',
              badge: unreadCount,
            });
          }
        }

        console.log(`App update notification sent to user ${userId}`);
      } catch (error) {
        console.error(`Failed to send app update notification to user ${userId}:`, error);
      }
    }

    console.log(`App update notifications sent to ${userIds.length} users`);
  } catch (error) {
    console.error('Error sending app update notifications:', error);
  }
}

export async function checkAndNotifyVersionChange(): Promise<void> {
  try {
    const currentVersion = getAppVersion();
    const storedVersion = await getStoredAppVersion();

    if (storedVersion === null) {
      console.log(`First startup or Redis empty. Storing current version and notifying: ${currentVersion}`);
      await storeAppVersion(currentVersion);
      await sendAppUpdateNotifications(currentVersion);
      return;
    }

    if (currentVersion !== storedVersion) {
      console.log(`App version changed from ${storedVersion} to ${currentVersion}`);
      await logActivity({
        type: 'app_updated',
        payload: { from_version: storedVersion, to_version: currentVersion },
      });
      await sendAppUpdateNotifications(currentVersion);
      await storeAppVersion(currentVersion);
    } else {
      console.log(`App version unchanged: ${currentVersion}`);
    }
  } catch (error) {
    console.error('Error checking app version change:', error);
  }
}
