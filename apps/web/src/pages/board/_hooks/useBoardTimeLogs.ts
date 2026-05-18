import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { BoardTimeLogsResponse } from "@hously/shared/types";

export function useBoardTimeLogs(taskId: number | null) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTasks.timeLogs(taskId ?? 0),
    queryFn: () =>
      fetcher<BoardTimeLogsResponse>(BOARD_TASKS_ENDPOINTS.TIME_LOGS(taskId!)),
    enabled: taskId !== null,
  });
}
