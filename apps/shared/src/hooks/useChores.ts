import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys, CHORES_ENDPOINTS } from '../index';
import type {
  ApiResult,
  ChoresResponse,
  CreateChoreRequest,
  UpdateChoreRequest,
  UploadChoreImageResponse,
} from '../types';

export function useChores() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.chores.list(),
    queryFn: () => fetcher<ChoresResponse>(CHORES_ENDPOINTS.LIST),
  });
}

export function useCreateChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChoreRequest) =>
      fetcher<ApiResult<{ id: number }>>(CHORES_ENDPOINTS.CREATE, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useToggleChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ choreId, emotion }: { choreId: number; emotion?: string }) =>
      fetcher<ApiResult<{ completed: boolean }>>(CHORES_ENDPOINTS.TOGGLE(choreId), {
        method: 'POST',
        body: { emotion },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useUpdateChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ choreId, data }: { choreId: number; data: UpdateChoreRequest }) =>
      fetcher<ApiResult<{ message: string }>>(CHORES_ENDPOINTS.UPDATE(choreId), {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    },
  });
}

export function useDeleteChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: number) =>
      fetcher<ApiResult<{ message: string }>>(CHORES_ENDPOINTS.DELETE(choreId), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useClearAllCompletedChores() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<ApiResult<{ message: string; count: number }>>(CHORES_ENDPOINTS.CLEAR_COMPLETED, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useRemoveRecurrence() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: number) =>
      fetcher<ApiResult<{ message: string }>>(CHORES_ENDPOINTS.REMOVE_RECURRENCE(choreId), {
        method: 'PUT',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    },
  });
}

export function useReorderChores() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreIds: number[]) =>
      fetcher<ApiResult<{ message: string }>>(CHORES_ENDPOINTS.REORDER, {
        method: 'POST',
        body: { chore_ids: choreIds },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    },
  });
}

export function useUploadChoreImage() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (formData: FormData) =>
      fetcher<UploadChoreImageResponse>(CHORES_ENDPOINTS.UPLOAD_IMAGE, {
        method: 'POST',
        body: formData,
      }),
  });
}
