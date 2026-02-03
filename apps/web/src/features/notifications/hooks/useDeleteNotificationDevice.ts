import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { notificationsApi } from "../api";

export function useDeleteNotificationDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: number) =>
      notificationsApi.deleteNotificationDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.devices(),
      });
    },
  });
}
