import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { HttpError } from "@/lib/api/httpClient";
import { queryKeys } from "@/lib/queryKeys";
import { AUTH_ENDPOINTS } from "@hously/shared/endpoints";
import type {
  UserResponse,
  ValidateInvitationResponse,
  AcceptInvitationRequest,
} from "@hously/shared/types";
type AuthResponse = UserResponse & { token?: string; refreshToken?: string };

function defaultLocale(): string {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.language === "string" &&
    navigator.language.length > 0
  ) {
    return navigator.language.split("-")[0] || "en";
  }
  return "en";
}

export function useCurrentUser() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const response = await fetcher<UserResponse>(AUTH_ENDPOINTS.ME);
        return response.user;
      } catch (error: unknown) {
        // Only return null for 401 (actually not authenticated)
        if (error instanceof HttpError && error.status === 401) {
          return null;
        }
        // Re-throw other errors (network, 429, 500) so TanStack Query
        // keeps the previous cached data instead of wiping the user
        throw error;
      }
    },
    retry: (failureCount, error: unknown) => {
      // Don't retry auth failures, but retry transient errors once
      if (error instanceof HttpError && error.status === 401) return false;
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useLogin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; password: string; locale?: string }) =>
      fetcher<AuthResponse>(AUTH_ENDPOINTS.LOGIN, {
        method: "POST",
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

export function useValidateInvitation(token: string) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.auth.validateInvitation(token),
    queryFn: () =>
      fetcher<ValidateInvitationResponse>(
        `${AUTH_ENDPOINTS.ACCEPT_INVITATION}?token=${encodeURIComponent(token)}`,
      ),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AcceptInvitationRequest) =>
      fetcher<AuthResponse>(AUTH_ENDPOINTS.ACCEPT_INVITATION, {
        method: "POST",
        body: data,
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
        method: "POST",
        body: subscriptionEndpoint
          ? { subscription: { endpoint: subscriptionEndpoint } }
          : {},
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
        method: "POST",
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
        method: "POST",
        body: {
          ...data,
          locale: data.locale || defaultLocale(),
        },
      }),
  });
}
