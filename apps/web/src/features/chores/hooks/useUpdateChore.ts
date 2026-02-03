import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";
import type { UpdateChoreRequest } from "../../../types";

export function useUpdateChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      choreId,
      data,
    }: {
      choreId: number;
      data: UpdateChoreRequest;
    }) => choresApi.updateChore(choreId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
