import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { prepareApnSession } from "@hously/api/utils/apnAuth";

interface ApnPushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  channelId?: string;
  badge?: number;
  contentAvailable?: boolean;
  /** If set, enables mutable-content so the app's Notification Service Extension can attach the image */
  imageUrl?: string;
}

export async function sendApnNotifications(
  tokens: string[],
  payload: ApnPushPayload,
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const session = prepareApnSession();
  if (!session) {
    console.warn("APNs credentials not configured.");
    return { successCount: 0, invalidTokens: [] };
  }

  const { bearerToken, baseUrl, topic } = session;

  try {
    const aps: Record<string, unknown> = {
      badge: payload.badge,
      "thread-id": payload.channelId,
      "content-available": payload.contentAvailable ? 1 : undefined,
      "mutable-content": payload.imageUrl ? 1 : undefined,
    };

    if (payload.title || payload.body) {
      aps.alert = { title: payload.title, body: payload.body };
    }

    const resolvedSound =
      payload.sound === null
        ? undefined
        : (payload.sound ?? (payload.contentAvailable ? undefined : "default"));
    if (resolvedSound) {
      aps.sound = resolvedSound;
    }

    const apnsPayload = {
      aps,
      ...payload.data,
      ...(payload.imageUrl ? { image_url: payload.imageUrl } : {}),
    };

    const payloadPath = join("/tmp", `apns_${Date.now()}.json`);
    writeFileSync(payloadPath, JSON.stringify(apnsPayload));

    let successCount = 0;
    const invalidTokens: string[] = [];

    for (const token of [...new Set(tokens)]) {
      try {
        const proc = Bun.spawnSync([
          "curl",
          "--http2",
          "--silent",
          "--show-error",
          "--header",
          `apns-topic: ${topic}`,
          "--header",
          `apns-push-type: ${payload.contentAvailable ? "background" : "alert"}`,
          "--header",
          `apns-priority: ${payload.contentAvailable ? "5" : "10"}`,
          "--header",
          `authorization: bearer ${bearerToken}`,
          "--data-binary",
          `@${payloadPath}`,
          `${baseUrl}/3/device/${token}`,
        ]);

        const stderr = proc.stderr.toString();
        const stdout = proc.stdout.toString();

        if (proc.success && !stdout.includes("reason")) {
          successCount++;
        } else {
          console.error(`APNs failure for ${token}:`, stdout || stderr);
          if (
            stdout.includes("BadDeviceToken") ||
            stdout.includes("Unregistered")
          ) {
            invalidTokens.push(token);
          }
        }
      } catch (e) {
        console.error(`Curl error for ${token}:`, e);
      }
    }

    unlinkSync(payloadPath);
    if (successCount > 0)
      console.log(`Sent ${successCount} APNs notifications via curl`);
    return { successCount, invalidTokens };
  } catch (error) {
    console.error("APNs Error:", error);
    return { successCount: 0, invalidTokens: [] };
  }
}
