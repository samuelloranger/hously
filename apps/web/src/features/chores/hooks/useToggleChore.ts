import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { syncBadge } from "../../../lib/serviceWorker";
import { choresApi } from "../api";

export function useToggleChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, emotion }: { id: number; emotion?: string }) =>
      choresApi.toggleChore(id, emotion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.refetchQueries({ queryKey: queryKeys.analytics.all });
      // Invalidate notification queries to update unread count
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      // Sync badge to reflect updated notification count
      syncBadge();
    },
  });
}
