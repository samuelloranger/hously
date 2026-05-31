import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { NotificationType } from "@hously/shared/types";
import { NotificationMenuRow } from "@/components/NotificationMenuRow";
import { openNotificationTarget } from "@/lib/notifications/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import {
  useNotificationStream,
  type StreamNotification,
} from "@/lib/notifications/useNotificationStream";

interface ToastNotification {
  id: string;
  title: string;
  body?: string;
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
  url?: string | null;
  leaving?: boolean;
}

const TOAST_DURATION = 8000;
const EXIT_DURATION = 300;

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  // Notification ids already shown, so a reconnect replay never double-banners.
  const seenIds = useRef(new Set<number>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  // The in-app banner is driven by the SSE notification stream — independent of
  // Web Push, so it works whether or not this browser has a push subscription.
  const handleNotification = useCallback(
    (notification: StreamNotification) => {
      if (seenIds.current.has(notification.id)) return;
      seenIds.current.add(notification.id);
      // Keep the dedup set bounded over long-lived sessions.
      if (seenIds.current.size > 300) {
        seenIds.current = new Set([...seenIds.current].slice(-150));
      }

      const toast: ToastNotification = {
        id: String(notification.id),
        title: notification.title || "Hously",
        body: notification.body,
        type: (notification.type as NotificationType) || "system",
        url: notification.url,
        metadata: notification.metadata ?? null,
      };

      setToasts((prev) => [...prev, toast]);
      setTimeout(() => dismiss(toast.id), TOAST_DURATION);
    },
    [dismiss],
  );

  // Only open the SSE stream for authenticated users — `NotificationToastContainer`
  // is mounted app-wide (incl. /login and other logged-out screens), and the
  // stream 401s without a session. Gating also (re)connects right after login
  // without a full reload, since `enabled` flips when auth resolves.
  const { isAuthenticated } = useAuth();
  useNotificationStream({
    onNotification: handleNotification,
    enabled: isAuthenticated,
  });

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden"
          style={{
            animation: toast.leaving
              ? `slideOutToLeft ${EXIT_DURATION}ms ease-in forwards`
              : `slideInFromLeft 250ms ease-out forwards`,
          }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Hously
            </span>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <NotificationMenuRow
            type={toast.type}
            title={toast.title}
            body={toast.body}
            metadata={toast.metadata}
            isUnread
            onClick={() => {
              if (toast.url) openNotificationTarget(toast.url);
              dismiss(toast.id);
            }}
          />
          <div className="h-0.5 bg-neutral-100 dark:bg-neutral-700/60">
            <div
              className="h-full bg-primary-500 origin-left"
              style={{
                animation: `shrink ${TOAST_DURATION}ms linear forwards`,
              }}
            />
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
