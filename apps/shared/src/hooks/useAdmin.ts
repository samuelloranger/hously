import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADMIN_ENDPOINTS, queryKeys } from '../index';
import { useFetcher } from './context';
import type {
  CreateUserRequest,
  CreateUserResponse,
  DeleteUserResponse,
  ExportDataResponse,
  ImportDataResponse,
  ListUsersResponse,
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

export function useTestEmailTemplates() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: ['admin', 'test-email-templates'] as const,
    queryFn: () => fetcher<TestEmailTemplatesResponse>(ADMIN_ENDPOINTS.TEST_EMAIL_TEMPLATES),
    staleTime: 5 * 60 * 1000,
  });
}
