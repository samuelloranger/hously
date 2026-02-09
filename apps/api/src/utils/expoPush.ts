import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
}

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export const isExpoPushToken = (token: string): boolean =>
  Expo.isExpoPushToken(token);

/**
 * Send push notifications via Expo Push API.
 * Returns tokens that should be deleted from DB (DeviceNotRegistered).
 */
export async function sendExpoPushNotifications(
  tokens: string[],
  payload: ExpoPushPayload
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const uniqueTokens = [...new Set(tokens)].filter(isExpoPushToken);
  if (uniqueTokens.length === 0) {
    return { successCount: 0, invalidTokens: [] };
  }

  const invalidTokens: string[] = [];
  let successCount = 0;

  const messages: ExpoPushMessage[] = uniqueTokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    sound: payload.sound ?? "default",
    channelId: payload.channelId,
    data: payload.data,
  }));

  const messageChunks = expo.chunkPushNotifications(messages);

  for (const chunk of messageChunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          successCount += 1;
          return;
        }

        const token = String(chunk[index]?.to ?? "");
        const errorCode = ticket.details?.error;
        console.error("Expo push ticket error:", {
          token,
          errorCode,
          message: ticket.message,
        });

        if (errorCode === "DeviceNotRegistered" && token) {
          invalidTokens.push(token);
        }
      });
    } catch (error) {
      console.error("Failed to send Expo push notifications chunk:", error);
    }
  }

  return { successCount, invalidTokens };
}
