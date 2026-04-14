import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { prepareApnSession } from "@hously/api/utils/apnAuth";

interface LiveActivityStartPayload {
  attributes: {
    habitId: number;
    emoji: string;
    name: string;
    timesPerDay: number;
  };
  contentState: {
    completions: number;
    scheduledTime: number; // Unix timestamp
  };
}

/**
 * Send an APNs push-to-start notification to start a Live Activity on iOS.
 * Uses the push-to-start token registered by the app.
 */
export async function sendLiveActivityStartPush(
  tokens: string[],
  payload: LiveActivityStartPayload,
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const session = prepareApnSession();
  if (!session) {
    console.warn("[LiveActivity] APNs credentials not configured.");
    return { successCount: 0, invalidTokens: [] };
  }

  const { baseUrl } = session;
  // The APNs topic for Live Activities is: <bundle-id>.push-type.liveactivity
  const liveActivityTopic = `${session.topic}.push-type.liveactivity`;

  const apnsPayload = {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: "start",
      "content-state": payload.contentState,
      "attributes-type": "HabitActivityAttributes",
      attributes: payload.attributes,
      alert: {
        title: `${payload.attributes.emoji} ${payload.attributes.name}`,
        body: "Time for your habit!",
      },
    },
  };

  try {
    const { bearerToken } = session;
    const payloadPath = join("/tmp", `apns_la_${Date.now()}.json`);
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
          `apns-topic: ${liveActivityTopic}`,
          "--header",
          "apns-push-type: liveactivity",
          "--header",
          "apns-priority: 10",
          "--header",
          `authorization: bearer ${bearerToken}`,
          "--header",
          "content-type: application/json",
          "--data-binary",
          `@${payloadPath}`,
          `${baseUrl}/3/device/${token}`,
        ]);

        const stderr = proc.stderr.toString();
        const stdout = proc.stdout.toString();

        if (proc.success && !stdout.includes("reason")) {
          successCount++;
        } else {
          console.error(
            `[LiveActivity] APNs failure for ${token.substring(0, 16)}...:`,
            stdout || stderr,
          );
          if (
            stdout.includes("BadDeviceToken") ||
            stdout.includes("Unregistered") ||
            stdout.includes("InvalidPushType")
          ) {
            invalidTokens.push(token);
          }
        }
      } catch (e) {
        console.error(
          `[LiveActivity] Curl error for ${token.substring(0, 16)}...:`,
          e,
        );
      }
    }

    unlinkSync(payloadPath);
    if (successCount > 0) {
      console.log(
        `[LiveActivity] Sent ${successCount} push-to-start notifications`,
      );
    }
    return { successCount, invalidTokens };
  } catch (error) {
    console.error("[LiveActivity] APNs Error:", error);
    return { successCount: 0, invalidTokens: [] };
  }
}
