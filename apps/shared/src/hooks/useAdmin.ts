import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { ADMIN_ENDPOINTS } from '../endpoints';
import type {
  AdminPushTokensResponse,
  AdminSessionsResponse,
  AdminWebPushResponse,
  CreateUserRequest,
  CreateUserResponse,
  DeletePushTokenResponse,
  DeleteUserResponse,
  DeleteWebPushResponse,
  ExportDataResponse,
  ImportDataResponse,
  ListUsersResponse,
  RevokeSessionResponse,
  ScheduledJobsResponse,
  TestEmailResponse,
  TestEmailTemplatesResponse,
  TriggerActionResponse,
} from '../types';

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
        method: 'POST',
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
        method: 'POST',
        body: { action },
      }),
  });
}

export function useScheduledJobs() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: ['admin', 'scheduled-jobs'] as const,
    queryFn: () => fetcher<ScheduledJobsResponse>(ADMIN_ENDPOINTS.SCHEDULED_JOBS),
    refetchInterval: 30000,
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

export function useCreateUser() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) =>
      fetcher<CreateUserResponse>(ADMIN_ENDPOINTS.USERS, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUser() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) =>
      fetcher<DeleteUserResponse>(ADMIN_ENDPOINTS.DELETE_USER(userId), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useTestEmail() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (templateId?: string) =>
      fetcher<TestEmailResponse>(ADMIN_ENDPOINTS.TEST_EMAIL, {
        method: 'POST',
        body: { template_id: templateId || 'test' },
      }),
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
      fetcher<RevokeSessionResponse>(ADMIN_ENDPOINTS.REVOKE_SESSION(id), { method: 'DELETE' }),
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
      fetcher<RevokeSessionResponse>(ADMIN_ENDPOINTS.REVOKE_USER_SESSIONS(userId), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sessions() });
    },
  });
}

export function useAdminPushTokens() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.pushTokens(),
    queryFn: () => fetcher<AdminPushTokensResponse>(ADMIN_ENDPOINTS.PUSH_TOKENS),
  });
}

export function useDeletePushToken() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<DeletePushTokenResponse>(ADMIN_ENDPOINTS.DELETE_PUSH_TOKEN(id), { method: 'DELETE' }),
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
      fetcher<DeleteWebPushResponse>(ADMIN_ENDPOINTS.DELETE_WEB_PUSH(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.webPush() });
    },
  });
}

export function useTestEmailTemplates() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: ['admin', 'test-email-templates'] as const,
    queryFn: () => fetcher<TestEmailTemplatesResponse>(ADMIN_ENDPOINTS.TEST_EMAIL_TEMPLATES),
    staleTime: 5 * 60 * 1000,
  });
}
