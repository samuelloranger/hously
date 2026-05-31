// Reliable client-side delivery of push events to open windows.
//
// The in-app notification banner listens for `notification-received` messages
// on this BroadcastChannel (see NotificationToastContainer). Previously the
// service worker created a fresh BroadcastChannel and called close() on it for
// every push; closing the channel in the same tick it posted raced message
// delivery against teardown, so the banner only showed intermittently. We now
// keep a single channel open for the service worker's lifetime instead.

const NOTIFICATION_EVENT_CHANNEL = "hously-notification-events";

let channel: BroadcastChannel | null = null;
let unsupported = false;

/**
 * Returns the long-lived notification BroadcastChannel, creating it on first
 * use. Returns null in environments without BroadcastChannel support.
 */
export function getNotificationChannel(): BroadcastChannel | null {
  if (unsupported) return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") {
    unsupported = true;
    return null;
  }
  channel = new BroadcastChannel(NOTIFICATION_EVENT_CHANNEL);
  return channel;
}

/**
 * Posts a message on the persistent notification channel. Safe to call even
 * when BroadcastChannel is unavailable (no-op). The channel is never closed so
 * the message is always dispatched on a live channel.
 */
export function broadcastNotificationEvent(payload: unknown): void {
  getNotificationChannel()?.postMessage(payload);
}
