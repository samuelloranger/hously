import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { ADMIN_ENDPOINTS } from "@hously/shared/endpoints";
import type { AdminPushTokensResponse, AdminSessionsResponse, AdminWebPushResponse, InviteUserRequest, InviteUserResponse, ListInvitationsResponse, ResendInvitationResponse, RevokeInvitationResponse, DeletePushTokenResponse, DeleteUserResponse, DeleteWebPushResponse, ExportDataResponse, ImportDataResponse, ListUsersResponse, RevokeSessionResponse, ScheduledJobsResponse, TriggerActionResponse } from "@hously/shared/types";
export function useExportData() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: () => fetcher<ExportDataResponse>(ADMIN_ENDPOINTS.EXPORT),
  });
}

export function useImportData() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetcher<ImportDataResponse>(ADMIN_ENDPOINTS.IMPORT, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useTriggerAction() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (action: string) =>
      fetcher<TriggerActionResponse>(ADMIN_ENDPOINTS.TRIGGER_ACTION, {
        method: "POST",
        body: { action },
      }),
  });
}

export function useScheduledJobs() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.scheduledJobs(),
    queryFn: () =>
      fetcher<ScheduledJobsResponse>(ADMIN_ENDPOINTS.SCHEDULED_JOBS),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
  });
}

export function useAdminUsers() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => fetcher<ListUsersResponse>(ADMIN_ENDPOINTS.USERS),
  });
}

export function useInviteUser() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteUserRequest) =>
      fetcher<InviteUserResponse>(ADMIN_ENDPOINTS.INVITE_USER, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.invitations(),
      });
    },
  });
}

export function useAdminInvitations() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.invitations(),
    queryFn: () =>
      fetcher<ListInvitationsResponse>(ADMIN_ENDPOINTS.INVITATIONS),
  });
}

export function useResendInvitation() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<ResendInvitationResponse>(ADMIN_ENDPOINTS.RESEND_INVITATION(id), {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.invitations(),
      });
    },
  });
}

export function useRevokeInvitation() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<RevokeInvitationResponse>(ADMIN_ENDPOINTS.REVOKE_INVITATION(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.invitations(),
      });
    },
  });
}

export function useDeleteUser() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      fetcher<DeleteUserResponse>(ADMIN_ENDPOINTS.DELETE_USER(userId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useAdminSessions() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.sessions(),
    queryFn: () => fetcher<AdminSessionsResponse>(ADMIN_ENDPOINTS.SESSIONS),
  });
}

export function useRevokeSession() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<RevokeSessionResponse>(ADMIN_ENDPOINTS.REVOKE_SESSION(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sessions() });
    },
  });
}

export function useRevokeUserSessions() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      fetcher<RevokeSessionResponse>(
        ADMIN_ENDPOINTS.REVOKE_USER_SESSIONS(userId),
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sessions() });
    },
  });
}

export function useAdminPushTokens() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.pushTokens(),
    queryFn: () =>
      fetcher<AdminPushTokensResponse>(ADMIN_ENDPOINTS.PUSH_TOKENS),
  });
}

export function useDeletePushToken() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<DeletePushTokenResponse>(ADMIN_ENDPOINTS.DELETE_PUSH_TOKEN(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pushTokens() });
    },
  });
}

export function useAdminWebPush() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.webPush(),
    queryFn: () => fetcher<AdminWebPushResponse>(ADMIN_ENDPOINTS.WEB_PUSH),
  });
}

export function useDeleteWebPush() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<DeleteWebPushResponse>(ADMIN_ENDPOINTS.DELETE_WEB_PUSH(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.webPush() });
    },
  });
}
