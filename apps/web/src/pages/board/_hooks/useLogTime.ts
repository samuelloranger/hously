import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { CreateTimeLogRequest } from "@hously/shared/types";

export function useLogTime() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: number;
      data: CreateTimeLogRequest;
    }) =>
      fetcher(BOARD_TASKS_ENDPOINTS.TIME_LOGS(taskId), {
        method: "POST",
        body: data,
      }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.boardTasks.timeLogs(taskId),
      });
    },
  });
}
