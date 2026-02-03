import { useMutation, useQueryClient } from "@tanstack/react-query";
import { choresApi } from "../api";
import { queryKeys } from "../../../lib/queryKeys";

export function useRemoveRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: number) => choresApi.removeRecurrence(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
