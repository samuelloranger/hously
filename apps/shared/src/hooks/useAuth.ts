import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { AUTH_ENDPOINTS } from '../endpoints';
import type { UserResponse } from '../types';

type AuthResponse = UserResponse & { token?: string; refreshToken?: string };

function defaultLocale(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.length > 0) {
    return navigator.language.split('-')[0] || 'en';
  }
  return 'en';
}

export function useCurrentUser() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const response = await fetcher<UserResponse>(AUTH_ENDPOINTS.ME);
        return response.user;
      } catch (error: any) {
        // If it's a 429, re-throw so the UI can handle it (e.g., show toast)
        if (error?.status === 429) {
          throw error;
        }
        return null;
      }
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function useLogin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; password: string; locale?: string }) =>
      fetcher<AuthResponse>(AUTH_ENDPOINTS.LOGIN, {
        method: 'POST',
        body: {
          ...data,
          locale: data.locale || defaultLocale(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useSignup() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      firstName?: string;
      lastName?: string;
      locale?: string;
    }) =>
      fetcher<AuthResponse>(AUTH_ENDPOINTS.SIGNUP, {
        method: 'POST',
        body: {
          email: data.email,
          password: data.password,
          first_name: data.first_name ?? data.firstName,
          last_name: data.last_name ?? data.lastName,
          locale: data.locale || defaultLocale(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionEndpoint?: string) =>
      fetcher<{ message: string }>(AUTH_ENDPOINTS.LOGOUT, {
        method: 'POST',
        body: subscriptionEndpoint ? { subscription: { endpoint: subscriptionEndpoint } } : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useForgotPassword() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: { email: string; locale?: string }) =>
      fetcher<{ message: string }>(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
        method: 'POST',
        body: {
          ...data,
          locale: data.locale || defaultLocale(),
        },
      }),
  });
}

export function useResetPassword() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (data: { token: string; password: string; locale?: string }) =>
      fetcher<{ message: string }>(AUTH_ENDPOINTS.RESET_PASSWORD, {
        method: 'POST',
        body: {
          ...data,
          locale: data.locale || defaultLocale(),
        },
      }),
  });
}
