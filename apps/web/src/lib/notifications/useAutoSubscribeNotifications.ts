import { useEffect, useState, useCallback, startTransition } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { useNotifications } from '@/lib/notifications/useNotifications';
import { getDeviceInfo } from '@/lib/device';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNotificationDevices,
  useSubscribeToPushNotifications,
  useUnsubscribeFromPushNotifications,
} from '@/hooks/useNotifications';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Hook that manages notification permission modal and subscription.
 * Returns modal state and handlers that should be triggered by user interaction.
 */
export function useAutoSubscribeNotifications() {
  const { user, isLoading: isUserLoading } = useAuth();
  const queryClient = useQueryClient();
  const { permission, requestPermission, subscription, isSubscriptionLoading, subscribe, isSupported } =
    useNotifications();
  const { refetch: refetchDevices } = useNotificationDevices({ enabled: false });
  const subscribeMutation = useSubscribeToPushNotifications();
  const unsubscribeMutation = useUnsubscribeFromPushNotifications();
  const [showModal, setShowModal] = useState(false);

  const verifySubscription = useCallback(async () => {
    if (isUserLoading || !user || !isSupported || isSubscriptionLoading) {
      setShowModal(false);
      return;
    }

    // Check if we had a subscription but permission was revoked (iOS behavior)
    const lastKnownEndpoint = localStorage.getItem('push-subscription-endpoint');

    if (permission !== 'granted' && lastKnownEndpoint && !subscription) {
      // Permission was revoked by iOS - clean up backend subscription
      console.warn('Detected iOS permission revocation - cleaning up backend subscription');
      try {
        await unsubscribeMutation.mutateAsync({ endpoint: lastKnownEndpoint });
        localStorage.removeItem('push-subscription-endpoint');
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.devices(),
        });
      } catch (error) {
        console.error('Error cleaning up revoked subscription:', error);
      }
      setShowModal(false);
      return;
    }

    // If permission already granted, ensure subscription is saved
    if (permission === 'granted') {
      if (subscription) {
        // If subscription exists but not in backend, re-register it instead of unsubscribing
        try {
          const devicesResponse = await refetchDevices();
          const devices = devicesResponse.data?.devices ?? [];
          const device = devices.find(device => device.endpoint === subscription?.endpoint);
          if (!device) {
            // Re-register the subscription with the backend
            const deviceInfo = getDeviceInfo();
            await subscribeMutation.mutateAsync({
              subscription: subscription as unknown as Record<string, unknown>,
              deviceInfo: deviceInfo as unknown as Record<string, unknown>,
            });
            // Invalidate devices query to refresh the list
            queryClient.invalidateQueries({
              queryKey: queryKeys.notifications.devices(),
            });
          }
        } catch (error) {
          console.error('Error verifying subscription:', error);
          // Don't unsubscribe on error - the subscription might still be valid
        }
      } else {
        setTimeout(() => {
          setShowModal(true);
        }, 1000);
      }
    }

    return;
  }, [
    isUserLoading,
    user,
    isSupported,
    isSubscriptionLoading,
    permission,
    subscription,
    queryClient,
    unsubscribeMutation,
    refetchDevices,
    subscribeMutation,
  ]);

  // Check if we should show the modal
  useEffect(() => {
    startTransition(() => {
      void verifySubscription();
    });
  }, [isUserLoading, user, isSupported, isSubscriptionLoading, permission, subscription, verifySubscription]);

  const handleAllow = useCallback(async () => {
    setShowModal(false);

    try {
      // If permission is already granted, skip requestPermission and go straight to subscribe
      let granted = permission === 'granted';

      if (!granted) {
        granted = await requestPermission();
      }

      if (granted) {
        // Subscribe to push notifications
        const subscription = await subscribe();
        if (subscription) {
          // Get device information
          const deviceInfo = getDeviceInfo();

          // Send subscription to backend with device info
          await subscribeMutation.mutateAsync({
            subscription: subscription as unknown as Record<string, unknown>,
            deviceInfo: deviceInfo as unknown as Record<string, unknown>,
          });
          // Invalidate devices query to refresh the list
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.devices(),
          });
        }
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  }, [requestPermission, subscribe, permission, queryClient, subscribeMutation]);

  // Handle user dismissing the modal
  const handleDismiss = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    showModal,
    handleAllow,
    handleDismiss,
  };
}
