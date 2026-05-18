import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";

export function useRemoveDependency() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, depId }: { id: number; depId: number }) =>
      fetcher(BOARD_TASKS_ENDPOINTS.REMOVE_DEPENDENCY(id, depId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}
