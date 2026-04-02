/**
 * Hook to automatically invalidate notification queries when new notifications are received
 * via service worker push notifications
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { type UnreadCountResponse } from '@hously/shared';

const syncNotificationTypes = ['notification-sync', 'notification-received'];
const NOTIFICATION_EVENT_CHANNEL = 'hously-notification-events';

export function useAutoInvalidateNotifications(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const processNotificationMessage = (data: unknown) => {
      if (
        data &&
        typeof data === 'object' &&
        'type' in data &&
        syncNotificationTypes.includes((data as { type: string }).type)
      ) {
        // Optimistically increment unread count for instant badge update
        if ((data as { type: string }).type === 'notification-received') {
          queryClient.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(), old => ({
            unread_count: (old?.unread_count ?? 0) + 1,
          }));
        }

        // Invalidate to refetch the real count and notification list
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        });

        // Also invalidate dashboard queries that might show notification counts
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all,
        });
      }
    };

    // Listen for messages from the service worker.
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      processNotificationMessage(event.data);
    };

    // BroadcastChannel fallback for browsers where client.postMessage delivery is inconsistent.
    let channel: BroadcastChannel | null = null;
    const handleChannelMessage = (event: MessageEvent) => {
      processNotificationMessage(event.data);
    };

    // Add event listener for service worker messages
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(NOTIFICATION_EVENT_CHANNEL);
      channel.addEventListener('message', handleChannelMessage);
    }

    // Cleanup
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      if (channel) {
        channel.removeEventListener('message', handleChannelMessage);
        channel.close();
      }
    };
  }, [queryClient]);
}
