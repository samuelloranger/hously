import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { BoardTaskActivityResponse } from "@hously/shared/types";

export function useBoardTaskActivity(taskId: number | null) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTasks.activity(taskId ?? 0),
    queryFn: () =>
      fetcher<BoardTaskActivityResponse>(
        BOARD_TASKS_ENDPOINTS.ACTIVITY(taskId!),
      ),
    enabled: taskId !== null,
  });
}
