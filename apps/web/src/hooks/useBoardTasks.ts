import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from '@/lib/api/context';
import { queryKeys } from '@/lib/queryKeys';
import { BOARD_TASKS_ENDPOINTS } from '@hously/shared';
import type {
  ApiResult,
  BoardTask,
  BoardTasksResponse,
  CreateBoardTaskRequest,
  SyncBoardTasksRequest,
  UpdateBoardTaskRequest,
} from '@hously/shared';

export function useBoardTasks() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTasks.list(),
    queryFn: () => fetcher<BoardTasksResponse>(BOARD_TASKS_ENDPOINTS.LIST),
  });
}

export function useCreateBoardTask() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBoardTaskRequest) =>
      fetcher<{ task: BoardTask }>(BOARD_TASKS_ENDPOINTS.CREATE, {
        method: 'POST',
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
        method: 'PATCH',
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
      fetcher<ApiResult<{ message: string }>>(BOARD_TASKS_ENDPOINTS.DELETE(id), {
        method: 'DELETE',
      }),
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
      fetcher<ApiResult<{ success?: boolean; message?: string }>>(BOARD_TASKS_ENDPOINTS.SYNC, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}
