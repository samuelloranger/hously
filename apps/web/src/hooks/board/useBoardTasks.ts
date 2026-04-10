import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TASKS_ENDPOINTS } from "@hously/shared/endpoints";
import type {
  ApiResult,
  BoardTask,
  BoardTasksResponse,
  BoardTaskActivityResponse,
  BoardTimeLogsResponse,
  CreateBoardTaskRequest,
  CreateTimeLogRequest,
  SyncBoardTasksRequest,
  UpdateBoardTaskRequest,
} from "@hously/shared/types";
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

export function useArchivedBoardTasks(enabled = true) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTasks.archived(),
    queryFn: () =>
      fetcher<BoardTasksResponse>(
        `${BOARD_TASKS_ENDPOINTS.LIST}?archived=true`,
      ),
    enabled,
  });
}

export function useSetBoardTaskArchived() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      fetcher<{ task: BoardTask }>(BOARD_TASKS_ENDPOINTS.UPDATE(id), {
        method: "PATCH",
        body: { archived },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}

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

export function useUpdateBoardTask() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBoardTaskRequest }) =>
      fetcher<{ task: BoardTask }>(BOARD_TASKS_ENDPOINTS.UPDATE(id), {
        method: "PATCH",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}

export function useDeleteBoardTask() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<ApiResult<{ message: string }>>(
        BOARD_TASKS_ENDPOINTS.DELETE(id),
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}

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

export function useAddDependency() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { blocking_task_id?: number; blocked_task_id?: number };
    }) =>
      fetcher(BOARD_TASKS_ENDPOINTS.ADD_DEPENDENCY(id), {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}

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

export function useBoardTimeLogs(taskId: number | null) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.boardTasks.timeLogs(taskId ?? 0),
    queryFn: () =>
      fetcher<BoardTimeLogsResponse>(BOARD_TASKS_ENDPOINTS.TIME_LOGS(taskId!)),
    enabled: taskId !== null,
  });
}

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
