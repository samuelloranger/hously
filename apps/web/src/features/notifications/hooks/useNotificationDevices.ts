import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { notificationsApi, NotificationDevicesResponse } from "../api";

export function useNotificationDevices(
  options?: Omit<
    UseQueryOptions<NotificationDevicesResponse>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: queryKeys.notifications.devices(),
    queryFn: notificationsApi.getNotificationDevices,
    ...options,
  });
}
