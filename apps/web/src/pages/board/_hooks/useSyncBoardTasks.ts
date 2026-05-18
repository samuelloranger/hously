import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { ApiResult, SyncBoardTasksRequest } from "@hously/shared/types";

export function useSyncBoardTasks() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SyncBoardTasksRequest) =>
      fetcher<ApiResult<{ success?: boolean; message?: string }>>(
        BOARD_TASKS_ENDPOINTS.SYNC,
        {
          method: "POST",
          body,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}
