import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";

export function useDeleteChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: number) => choresApi.deleteChore(choreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
