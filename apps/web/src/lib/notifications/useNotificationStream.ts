import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface StreamNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  url: string | null;
  metadata?: Record<string, unknown> | null;
}

interface UseNotificationStreamOptions {
  /** Called for each new notification pushed over the stream. */
  onNotification: (notification: StreamNotification) => void;
  enabled?: boolean;
}

/**
 * Subscribes to the server-sent notification stream (`/api/notifications/stream`)
 * for the current user. On each new notification it refetches the notifications
 * list + unread count (so the bell stays correct even with no push subscription)
 * and hands the notification to `onNotification` for the in-app banner.
 *
 * This is the push-independent delivery path: it works whenever the app is open,
 * regardless of browser notification permission. Mount once at the app root.
 */
export function useNotificationStream({
  onNotification,
  enabled = true,
}: UseNotificationStreamOptions): void {
  const queryClient = useQueryClient();
  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof globalThis.EventSource === "undefined") return;

    const source = new EventSource("/api/notifications/stream", {
      withCredentials: true,
    });

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as
          | { connected?: boolean }
          | StreamNotification;
        if ((data as { connected?: boolean }).connected) return; // handshake
        const notification = data as StreamNotification;
        if (typeof notification.id !== "number") return;

        // Keep the bell + notifications list in sync without a push round-trip.
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

        onNotificationRef.current(notification);
      } catch {
        // malformed event — ignore
      }
    };

    return () => source.close();
  }, [enabled, queryClient]);
}
