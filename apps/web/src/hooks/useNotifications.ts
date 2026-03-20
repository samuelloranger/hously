import { useNotificationPermission } from './useNotificationPermission';
import { usePushSubscription } from './usePushSubscription';
import type { PushSubscriptionData } from './usePushSubscriptionUtils';

interface UseNotificationsReturn {
  permission: NotificationPermission;
  subscription: PushSubscriptionData | null;
  isSubscriptionLoading: boolean;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<PushSubscriptionData | null>;
  unsubscribe: () => Promise<boolean>;
  isSupported: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const { permission, isSupported, requestPermission } = useNotificationPermission();
  const { subscription, isLoading, subscribe, unsubscribe } = usePushSubscription(isSupported, permission);

  return {
    permission,
    subscription,
    isSubscriptionLoading: isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
  };
}
