/**
 * Version service for checking app version changes and notifying users
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../db";
import { logActivity } from "../utils/activityLogs";
import { getJsonCache, setJsonCache } from "./cache";
import { sendExternalNotification } from "./externalNotificationService";
import { createAndQueueNotification } from "../workers/notificationService";

const PACKAGE_VERSION = "1.0.0";
const APP_VERSION_KEY = "hously:app_version";

function getCurrentAppVersion(): string {
  try {
    const versionFromFile = readFileSync(
      resolve(process.cwd(), "package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(versionFromFile);
    return pkg.version || PACKAGE_VERSION;
  } catch {
    return PACKAGE_VERSION;
  }
}

export function getAppVersion(): string {
  return getCurrentAppVersion();
}

async function getStoredAppVersion(): Promise<string | null> {
  return await getJsonCache<string>(APP_VERSION_KEY);
}

async function storeAppVersion(version: string): Promise<void> {
  // Store with a very long TTL (e.g., 1 year) as this is semi-permanent state
  await setJsonCache(APP_VERSION_KEY, version, 365 * 24 * 60 * 60);
  console.log(`Stored app version in Redis: ${version}`);
}

async function sendAppUpdateNotifications(newVersion?: string): Promise<void> {
  try {
    const version = newVersion || getAppVersion();

    // 1. Send "External" notification via the notification service if configured
    try {
      await sendExternalNotification(
        "hously",
        "AppUpdate",
        {
          template_variables: {
            version,
            message: `Hously has been updated to version ${version}`,
            environment: process.env.NODE_ENV || "production",
          },
          original_payload: {
            version,
            event: "AppUpdate",
            timestamp: new Date().toISOString(),
          },
        },
        "en",
      );
    } catch (err) {
      console.warn("Failed to send external hously notification:", err);
    }

    // 2. Standard internal notifications (Web Push, Expo Push)
    // Get all users who have at least one delivery channel
    const userIds = await prisma.user.findMany({
      where: {
        OR: [{ userSubscriptions: { some: {} } }, { pushTokens: { some: {} } }],
      },
      select: { id: true },
    });

    if (userIds.length === 0) {
      console.log(
        "No users with subscriptions found for app update notification",
      );
      return;
    }

    console.log(
      `[VersionService] Enqueuing app update notifications for version ${version} to ${userIds.length} users`,
    );

    for (const { id: userId } of userIds) {
      await createAndQueueNotification(
        userId,
        "App Updated",
        `Hously has been updated to version ${version}`,
        "app-update",
        "/",
        { version, silent: true },
      );
    }

    console.log(
      `[VersionService] App update notifications enqueued for ${userIds.length} users`,
    );
  } catch (error) {
    console.error(
      "[VersionService] Error sending app update notifications:",
      error,
    );
  }
}

export async function checkAndNotifyVersionChange(): Promise<void> {
  try {
    const currentVersion = getAppVersion();
    const storedVersion = await getStoredAppVersion();

    if (storedVersion === null) {
      console.log(
        `First startup or Redis empty. Storing current version and notifying: ${currentVersion}`,
      );
      await storeAppVersion(currentVersion);
      await sendAppUpdateNotifications(currentVersion);
      return;
    }

    if (currentVersion !== storedVersion) {
      console.log(
        `App version changed from ${storedVersion} to ${currentVersion}`,
      );
      await logActivity({
        type: "app_updated",
        payload: { from_version: storedVersion, to_version: currentVersion },
      });
      await sendAppUpdateNotifications(currentVersion);
      await storeAppVersion(currentVersion);
    } else {
      console.log(`App version unchanged: ${currentVersion}`);
    }
  } catch (error) {
    console.error("Error checking app version change:", error);
  }
}
