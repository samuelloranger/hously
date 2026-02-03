import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useNotifications } from "./useNotifications";
import { fetchApi } from "../lib/api";
import { getDeviceInfo } from "../lib/deviceInfo";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { notificationsApi } from "@/features/notifications/api";

/**
 * Hook that manages notification permission modal and subscription.
 * Returns modal state and handlers that should be triggered by user interaction.
 */
export function useAutoSubscribeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { permission, requestPermission, subscription, subscribe, isSupported } =
    useNotifications();
  const [showModal, setShowModal] = useState(false);

  const verifySubscription = useCallback(async () => {
    if (!user || !isSupported) {
      setShowModal(false);
      return;
    }

    // Check if we had a subscription but permission was revoked (iOS behavior)
    const lastKnownEndpoint = localStorage.getItem("push-subscription-endpoint");

    if (permission !== "granted" && lastKnownEndpoint && !subscription) {
      // Permission was revoked by iOS - clean up backend subscription
      console.warn("Detected iOS permission revocation - cleaning up backend subscription");
      try {
        await fetchApi("/api/notifications/unsubscribe", {
          method: "POST",
          body: JSON.stringify({
            subscription: { endpoint: lastKnownEndpoint },
          }),
        });
        localStorage.removeItem("push-subscription-endpoint");
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.devices(),
        });
      } catch (error) {
        console.error("Error cleaning up revoked subscription:", error);
      }
      setShowModal(false);
      return;
    }

    // If permission already granted, ensure subscription is saved
    if (permission === "granted") {
      if (subscription) {
        // If subscription exists but not in backend, re-register it instead of unsubscribing
        try {
          const { devices } = await notificationsApi.getNotificationDevices();
          const device = devices.find((device) => device.endpoint === subscription?.endpoint);
          if (!device) {
            // Re-register the subscription with the backend
            const deviceInfo = getDeviceInfo();
            await fetchApi("/api/notifications/subscribe", {
              method: "POST",
              body: JSON.stringify({
                subscription,
                device_info: deviceInfo,
              }),
            });
            // Invalidate devices query to refresh the list
            queryClient.invalidateQueries({
              queryKey: queryKeys.notifications.devices(),
            });
          }
        } catch (error) {
          console.error("Error verifying subscription:", error);
          // Don't unsubscribe on error - the subscription might still be valid
        }
      } else {
        setTimeout(() => {
          setShowModal(true);
        }, 1000);
      }
    }

    return;
  }, [user, isSupported, permission, subscription, queryClient]);

  // Check if we should show the modal
  useEffect(() => {
    verifySubscription();
  }, [user, isSupported, permission, subscription]);

  const handleAllow = useCallback(async () => {
    setShowModal(false);

    try {
      // If permission is already granted, skip requestPermission and go straight to subscribe
      let granted = permission === "granted";
      
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
          await fetchApi("/api/notifications/subscribe", {
            method: "POST",
            body: JSON.stringify({
              subscription,
              device_info: deviceInfo,
            }),
          });
          // Invalidate devices query to refresh the list
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.devices(),
          });
        }
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    }
  }, [requestPermission, subscribe, permission]);

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


