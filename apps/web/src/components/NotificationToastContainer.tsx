import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { NotificationType } from '@hously/shared';
import { NotificationMenuRow } from './NotificationMenuRow';
import { openNotificationTarget } from '../lib/notificationNavigation';

interface ToastNotification {
  id: string;
  title: string;
  body?: string;
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
  url?: string | null;
}

interface IncomingMessageData {
  type: string;
  notificationData?: {
    title?: string;
    body?: string;
    data?: {
      notification_type?: string | null;
      url?: string;
    };
  };
}

const NOTIFICATION_EVENT_CHANNEL = 'hously-notification-events';
const TOAST_DURATION = 8000;
const DEDUP_WINDOW_MS = 2000;

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const recentKeys = useRef(new Set<string>());

  useEffect(() => {
    const handleMessage = (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const msg = data as IncomingMessageData;
      if (msg.type !== 'notification-received' || !msg.notificationData) return;

      const notifData = msg.notificationData;
      const dedupKey = `${notifData.title}:${notifData.body}`;
      if (recentKeys.current.has(dedupKey)) return;
      recentKeys.current.add(dedupKey);
      setTimeout(() => recentKeys.current.delete(dedupKey), DEDUP_WINDOW_MS);

      const toast: ToastNotification = {
        id: `${Date.now()}-${Math.random()}`,
        title: notifData.title || 'Hously',
        body: notifData.body,
        type: (notifData.data?.notification_type as NotificationType) || 'system',
        url: notifData.data?.url || null,
      };

      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, TOAST_DURATION);
    };

    const handleSWMessage = (event: MessageEvent) => handleMessage(event.data);
    const handleChannelMessage = (event: MessageEvent) => handleMessage(event.data);

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(NOTIFICATION_EVENT_CHANNEL);
      channel.addEventListener('message', handleChannelMessage);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
      if (channel) {
        channel.removeEventListener('message', handleChannelMessage);
        channel.close();
      }
    };
  }, []);

  if (toasts.length === 0) return null;

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return createPortal(
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden animate-in slide-in-from-left-4 fade-in duration-200"
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
              style={{ animation: `shrink ${TOAST_DURATION}ms linear forwards` }}
            />
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
