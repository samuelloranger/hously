import type { UnreadCountResponse } from "./types";

// Sync badge count from server
export async function syncBadgeCount(): Promise<void> {
  if (!("setAppBadge" in navigator && navigator.setAppBadge)) {
    return;
  }

  try {
    const response = await fetch("/api/notifications/unread-count", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data: UnreadCountResponse = await response.json();
      if (data?.unread_count) {
        navigator.setAppBadge(data.unread_count);
      } else {
        navigator.clearAppBadge();
      }
    }
  } catch (err) {
    console.error("Error syncing badge count:", err);
  }
}

