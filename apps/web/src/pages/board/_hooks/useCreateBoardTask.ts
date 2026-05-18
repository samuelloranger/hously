import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { BoardTask, CreateBoardTaskRequest } from "@hously/shared/types";

export function useCreateBoardTask() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBoardTaskRequest) =>
      fetcher<{ task: BoardTask }>(BOARD_TASKS_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}
