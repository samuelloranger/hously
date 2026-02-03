import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";

export function useClearAllCompletedChores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => choresApi.clearAllCompleted(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
