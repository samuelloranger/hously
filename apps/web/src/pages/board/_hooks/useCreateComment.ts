import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";

export function useCreateComment() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: string }) =>
      fetcher(BOARD_TASKS_ENDPOINTS.COMMENT(taskId), {
        method: "POST",
        body: { body },
      }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.boardTasks.activity(taskId),
      });
    },
  });
}
