import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/useNotifications";
import {
  useDeleteNotificationDevice,
  useNotificationDevices,
  useSubscribeToPushNotifications,
  useTestPushNotification,
} from "@/hooks/useNotifications";
import { queryKeys } from "@/lib/queryKeys";
import { getDeviceInfo } from "@/lib/device";
import { useAuth } from "@/lib/auth/useAuth";

export function NotificationsTab() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
  } = useNotifications();
  const [loading, setLoading] = useState(false);

  const { data: devicesData, isLoading: devicesLoading } =
    useNotificationDevices();
  const devices = devicesData?.devices || [];
  const deleteDeviceMutation = useDeleteNotificationDevice();
  const subscribeMutation = useSubscribeToPushNotifications();
  const testNotificationMutation = useTestPushNotification();

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        toast.error(t("settings.notifications.permissionDenied"));
      }
    } catch {
      toast.error(t("settings.notifications.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (permission !== "granted") {
      toast.error(t("settings.notifications.permissionDenied"));
      return;
    }

    setLoading(true);
    try {
      const sub = await subscribe();
      if (sub) {
        // Get device information
        const deviceInfo = getDeviceInfo();

        // Send subscription to backend with device info
        await subscribeMutation.mutateAsync({
          subscription: sub as unknown as Record<string, unknown>,
          deviceInfo: deviceInfo as unknown as Record<string, unknown>,
        });
        toast.success(t("settings.notifications.subscribeSuccess"));
        // Invalidate devices query to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.devices(),
        });
      } else {
        toast.error(t("settings.notifications.error"));
      }
    } catch (error) {
      console.error("Error subscribing:", error);
      toast.error(t("settings.notifications.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const success = await unsubscribe();
      if (success) {
        toast.success(t("settings.notifications.unsubscribeSuccess"));
        // Invalidate devices query to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.devices(),
        });
      } else {
        toast.error(t("settings.notifications.error"));
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error(t("settings.notifications.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm(t("settings.notifications.deleteDeviceConfirm"))) {
      return;
    }

    setLoading(true);
    try {
      await deleteDeviceMutation.mutateAsync(deviceId);
      toast.success(t("settings.notifications.deviceDeleted"));
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error(t("settings.notifications.deleteDeviceError"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (input: string | Date | null) => {
    if (!input) return t("settings.notifications.unknownDate");
    try {
      const date = input instanceof Date ? input : new Date(input);
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return t("settings.notifications.unknownDate");
    }
  };

  const getDeviceDisplayName = (device: (typeof devices)[0]) => {
    // Use device name if available
    if (device.device_name) {
      return device.device_name;
    }

    // Build name from browser and OS info
    const parts: string[] = [];

    if (device.browser_name) {
      const browserVersion = device.browser_version
        ? ` ${device.browser_version}`
        : "";
      parts.push(`${device.browser_name}${browserVersion}`);
    }

    if (device.os_name) {
      const osVersion = device.os_version ? ` ${device.os_version}` : "";
      parts.push(`on ${device.os_name}${osVersion}`);
    }

    if (parts.length > 0) {
      return parts.join(" ");
    }

    // Fallback to platform if available
    if (device.platform) {
      return device.platform;
    }

    // Last resort: try to guess from endpoint
    if (device.endpoint) {
      if (device.endpoint.includes("chrome"))
        return t("settings.notifications.chromeDevice");
      if (device.endpoint.includes("firefox"))
        return t("settings.notifications.firefoxDevice");
      if (device.endpoint.includes("safari"))
        return t("settings.notifications.safariDevice");
    }

    return t("settings.notifications.unknownDevice");
  };

  const handleTestNotification = async () => {
    setLoading(true);
    try {
      await testNotificationMutation.mutateAsync();
      toast.success("Test notification sent! Check your notifications.");
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300"
      key="notifications-tab"
    >
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
          {t("settings.notifications.title")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.notifications.description")}
        </p>

        {!isSupported ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg">
            {t("settings.notifications.notSupported")}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Test Notification Button */}
            {user?.is_admin && (
              <div>
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Test Notification
                </h3>
                <button
                  onClick={handleTestNotification}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send Test Notification
                </button>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  Click to send a test notification to verify everything is
                  working.
                </p>
              </div>
            )}

            {/* Permission Status */}
            <div>
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t("settings.notifications.permission")}
              </h3>
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                <span className="text-neutral-900 dark:text-neutral-100">
                  {t(`settings.notifications.status.${permission}`)}
                </span>
                {permission !== "granted" && (
                  <button
                    onClick={handleRequestPermission}
                    disabled={loading || permission === "denied"}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("settings.notifications.requestPermission")}
                  </button>
                )}
              </div>
              {permission === "denied" && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {t("settings.notifications.permissionDenied")}
                </p>
              )}
            </div>

            {/* Subscription Status */}
            {permission === "granted" && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t("settings.notifications.subscription")}
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {subscription
                        ? t("settings.notifications.subscribed")
                        : t("settings.notifications.notSubscribed")}
                    </span>
                    {subscription ? (
                      <button
                        onClick={handleUnsubscribe}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {t("settings.notifications.unsubscribe")}
                      </button>
                    ) : (
                      <button
                        onClick={handleSubscribe}
                        disabled={loading || !isSupported}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {t("settings.notifications.subscribe")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Devices List */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t("settings.notifications.devices")}
                  </h3>
                  {devicesLoading ? (
                    <div className="p-4 text-center text-neutral-600 dark:text-neutral-400">
                      {t("settings.notifications.loadingDevices")}
                    </div>
                  ) : devices.length === 0 ? (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg text-neutral-600 dark:text-neutral-400 text-sm">
                      {t("settings.notifications.noDevices")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {getDeviceDisplayName(device)}
                              </span>
                              {subscription &&
                                (
                                  subscription as unknown as {
                                    endpoint: string;
                                  }
                                ).endpoint === device.endpoint && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400 uppercase tracking-wide flex-shrink-0">
                                    {t("settings.notifications.thisDevice")}
                                  </span>
                                )}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {t("settings.notifications.addedOn")}{" "}
                              {formatDate(device.created_at)}
                            </div>
                            {(device.browser_name || device.os_name) && (
                              <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                                {device.browser_name &&
                                  device.browser_version && (
                                    <span>
                                      {device.browser_name}{" "}
                                      {device.browser_version}
                                    </span>
                                  )}
                                {device.browser_name && device.os_name && " • "}
                                {device.os_name && (
                                  <span>
                                    {device.os_name}
                                    {device.os_version &&
                                      ` ${device.os_version}`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteDevice(device.id)}
                            disabled={loading}
                            className="ml-4 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={t("settings.notifications.deleteDevice")}
                          >
                            {t("settings.notifications.delete")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
