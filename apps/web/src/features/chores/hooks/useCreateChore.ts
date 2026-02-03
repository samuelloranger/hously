import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";
import type { CreateChoreRequest } from "../../../types";

export function useCreateChore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChoreRequest) => choresApi.createChore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
