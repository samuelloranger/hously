import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { USERS_ENDPOINTS, queryKeys } from '../index';
import { useFetcher } from './context';
import type { ChangePasswordRequest, UpdateProfileRequest, UserResponse, UsersResponse } from '../types';

export function useUsers() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => fetcher<UsersResponse>(USERS_ENDPOINTS.LIST),
    refetchOnMount: true,
  });
}

export function useUpdateProfile() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) =>
      fetcher<UserResponse>(USERS_ENDPOINTS.ME, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      queryClient.setQueryData(queryKeys.auth.me, response.user);
    },
  });
}

export function useChangePassword() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      fetcher<{ message: string }>(USERS_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        body: data,
      }),
  });
}

export function useUploadAvatar() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      fetcher<{ message: string; avatar_url: string; url?: string }>(USERS_ENDPOINTS.AVATAR, {
        method: 'POST',
        body: formData,
      }),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      queryClient.setQueryData(queryKeys.auth.me, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          avatar_url: response.avatar_url || response.url,
        };
      });
    },
  });
}
