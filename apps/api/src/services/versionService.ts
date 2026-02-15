/**
 * Version service for checking app version changes and notifying users
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../db';
import { sendWebPushNotification, type PushSubscription } from '../utils/webpush';
import { sendExpoPushNotifications } from '../utils/expoPush';

const VERSION_FILE_PATH = process.env.VERSION_FILE_PATH || '/app/.stored_version';
const PACKAGE_VERSION = '1.0.0';

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

function getStoredAppVersion(): string | null {
  try {
    if (existsSync(VERSION_FILE_PATH)) {
      return readFileSync(VERSION_FILE_PATH, 'utf-8').trim();
    }
  } catch (error) {
    console.debug(`Could not read stored version file: ${error}`);
  }
  return null;
}

function storeAppVersion(version: string): void {
  try {
    writeFileSync(VERSION_FILE_PATH, version);
    console.log(`Stored app version: ${version}`);
  } catch (error) {
    console.error(`Could not store app version: ${error}`);
  }
}

async function sendAppUpdateNotifications(newVersion: string): Promise<void> {
  try {
    const userIds = await prisma.userSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });

    if (userIds.length === 0) {
      console.log('No users with subscriptions found for app update notification');
      return;
    }

    console.log(`Sending app update notifications to ${userIds.length} users`);

    for (const { userId } of userIds) {
      try {
        const notification = await prisma.notification.create({
          data: {
            userId,
            title: 'App Updated',
            body: `Hously has been updated to version ${newVersion}`,
            type: 'app-update',
            url: '/',
            notificationMetadata: { version: newVersion, silent: true },
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
              body: `Hously has been updated to version ${newVersion}`,
              tag: 'app-update',
              data: {
                url: '/',
                notification_type: 'app-update',
                notification_id: notification.id,
                version: newVersion,
                silent: true,
              },
            });
          } catch (error) {
            console.error(`Error sending push to subscription ${sub.id}:`, error);
          }
        }

        const pushTokens = await prisma.pushToken.findMany({
          where: { userId },
          select: { token: true },
        });

        if (pushTokens.length > 0) {
          await sendExpoPushNotifications(
            pushTokens.map(t => t.token),
            {
              title: 'App Updated',
              body: `Hously has been updated to version ${newVersion}`,
              data: {
                url: '/',
                notification_type: 'app-update',
                notification_id: notification.id,
                version: newVersion,
                silent: true,
              },
              channelId: 'default',
            }
          );
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
    const storedVersion = getStoredAppVersion();

    storeAppVersion(currentVersion);

    if (storedVersion === null) {
      console.log(`First startup detected with version: ${currentVersion}`);
      return;
    }

    if (currentVersion !== storedVersion) {
      console.log(`App version changed from ${storedVersion} to ${currentVersion}`);
      await sendAppUpdateNotifications(currentVersion);
    } else {
      console.log(`App version unchanged: ${currentVersion}`);
    }
  } catch (error) {
    console.error('Error checking app version change:', error);
  }
}
