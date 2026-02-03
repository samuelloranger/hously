import { useState, useEffect, useCallback } from "react";
import { fetchApi } from "../lib/api";

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UseNotificationsReturn {
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
  isSupported: boolean;
}

const saveEndpoint = (endpoint: string) => {
  try {
    localStorage.setItem("push-subscription-endpoint", endpoint);
  } catch (e) {
    console.warn("Failed to save subscription to localStorage:", e);
  }
};

const removeEndpoint = () => {
  try {
    localStorage.removeItem("push-subscription-endpoint");
  } catch (e) {
    console.warn("Failed to remove subscription from localStorage:", e);
  }
};

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check and sync subscription state
  const checkSubscriptionState = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const subData = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
            auth: arrayBufferToBase64(sub.getKey("auth")!),
          },
        };
        setSubscription(subData);
        saveEndpoint(sub.endpoint);
      } else {
        setSubscription(null);
        removeEndpoint();
      }
    } catch (err) {
      console.error("Error getting subscription:", err);
    }
  }, []);

  useEffect(() => {
    // Check if notifications and service workers are supported
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);

    if (supported) {
      // Get current permission status
      setPermission(Notification.permission);

      checkSubscriptionState();

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          const currentPermission = Notification.permission;
          setPermission(currentPermission);
          if (currentPermission === "granted") {
            checkSubscriptionState();
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
    return;
  }, [checkSubscriptionState]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notifications not supported");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== "granted") {
      console.warn("Notifications not supported or permission not granted");
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        const sub = {
          endpoint: existingSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(existingSubscription.getKey("p256dh")!),
            auth: arrayBufferToBase64(existingSubscription.getKey("auth")!),
          },
        };
        setSubscription(sub);
        return sub;
      }

      // Get VAPID public key from backend
      let vapidPublicKey: string;
      
      try {
        const data = await fetchApi<{ publicKey: string }>("/api/notifications/vapid-public-key");
          vapidPublicKey = data.publicKey;
          
          if (!vapidPublicKey) {
          return null;
        }
      } catch (error) {
        // Backend not available, network error, or non-JSON response
        console.warn("Could not get VAPID public key from backend:", error);
        return null;
      }

      // Convert VAPID key to Uint8Array
      const vapidKey: Uint8Array = urlBase64ToUint8Array(vapidPublicKey);
      const keyBuffer = new Uint8Array(vapidKey).buffer;
      
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      const sub = {
        endpoint: newSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(newSubscription.getKey("p256dh")!),
          auth: arrayBufferToBase64(newSubscription.getKey("auth")!),
        },
      };

      setSubscription(sub);
      saveEndpoint(newSubscription.endpoint);
      return sub;
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      return null;
    }
  }, [isSupported, permission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notifications not supported");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      let endpoint: string | null = null;
      if (existingSubscription) {
        endpoint = existingSubscription.endpoint;
        await existingSubscription.unsubscribe();
        setSubscription(null);
        removeEndpoint();
      }

      // Also notify backend with the endpoint to unsubscribe the specific device
      try {
        await fetchApi("/api/notifications/unsubscribe", {
          method: "POST",
          body: JSON.stringify({
            subscription: endpoint ? { endpoint } : undefined,
          }),
        });
      } catch (error) {
        console.warn("Failed to notify backend of unsubscribe:", error);
        // Continue anyway, the client-side unsubscribe succeeded
      }

      return true;
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      return false;
    }
  }, [isSupported]);

  return {
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
  };
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert a base64url or base64 string to Uint8Array
 * Handles both standard base64 and base64url (URL-safe) formats
 * Also handles PEM format by extracting the base64 content
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Remove any whitespace
  let cleanedString = base64String.trim();
  
  // If it's a PEM format, extract the base64 content
  if (cleanedString.includes("-----BEGIN")) {
    // Extract base64 content between headers
    const base64Match = cleanedString.match(/-----BEGIN[^-]+-----\s*([A-Za-z0-9+/=\s]+)\s*-----END[^-]+-----/);
    if (base64Match && base64Match[1]) {
      cleanedString = base64Match[1].replace(/\s/g, "");
    } else {
      throw new Error("Invalid PEM format: could not extract base64 content");
    }
  }
  
  // Convert base64url to standard base64
  // Base64url uses - and _ instead of + and /, and no padding
  let base64 = cleanedString.replace(/-/g, "+").replace(/_/g, "/");
  
  // Add padding if needed (base64 strings must be multiples of 4)
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  base64 = base64 + padding;
  
  try {
    // Decode base64 to binary string
    const rawData = window.atob(base64);
    
    // Convert binary string to Uint8Array
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  } catch (error) {
    console.error("Error decoding base64 string:", error);
    console.error("Input string (first 100 chars):", cleanedString.substring(0, 100));
    throw new Error(`Invalid base64 string: ${error}`);
  }
}

