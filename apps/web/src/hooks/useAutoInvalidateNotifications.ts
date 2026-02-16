/**
 * Hook to automatically invalidate notification queries when new notifications are received
 * via service worker push notifications
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@hously/shared';

const syncNotificationTypes = ['notification-sync', 'notification-received'];

export function useAutoInvalidateNotifications(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listen for messages from the service worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && syncNotificationTypes.includes(event.data.type)) {
        console.log('Received notification from service worker, invalidating queries');

        // Invalidate notification-related queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        });

        // Also invalidate dashboard queries that might show notification counts
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all,
        });
      }
    };

    // Add event listener for service worker messages
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    // Cleanup
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [queryClient]);
}
