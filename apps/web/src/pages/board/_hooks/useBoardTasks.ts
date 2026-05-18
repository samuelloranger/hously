import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import type { BoardTasksResponse } from "@hously/shared/types";

export function useBoardTasks() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTasks.list(),
    queryFn: () =>
      fetcher<BoardTasksResponse>(
        `${BOARD_TASKS_ENDPOINTS.LIST}?archived=false`,
      ),
  });
}
