import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { EXTERNAL_NOTIFICATION_ENDPOINTS } from '../endpoints';
import type {
  LogsResponse,
  ServiceResponse,
  ServicesResponse,
  TemplateResponse,
  TemplatesResponse,
} from '../types';

export function useExternalNotificationServices() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.externalNotifications.services(),
    queryFn: () => fetcher<ServicesResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.SERVICES),
  });
}

export function useExternalNotificationLogs() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.externalNotifications.logs(),
    queryFn: () => fetcher<LogsResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.LOGS),
  });
}

export function useEnableExternalNotificationService() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.ENABLE_SERVICE(serviceId), {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
    },
  });
}

export function useDisableExternalNotificationService() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.DISABLE_SERVICE(serviceId), {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
    },
  });
}

export function useRegenerateExternalNotificationToken() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.REGENERATE_TOKEN(serviceId), {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
    },
  });
}

export function useUpdateExternalNotificationAdminsOnly() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, notifyAdminsOnly }: { serviceId: number; notifyAdminsOnly: boolean }) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.UPDATE_NOTIFY_ADMINS_ONLY(serviceId), {
        method: 'POST',
        body: { notify_admins_only: notifyAdminsOnly },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
    },
  });
}

export function useToggleExternalNotificationTemplate() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, eventType, enabled }: { serviceId: number; eventType: string; enabled: boolean }) =>
      fetcher<{ success: boolean; updated: number }>(EXTERNAL_NOTIFICATION_ENDPOINTS.TOGGLE_TEMPLATE, {
        method: 'POST',
        body: { service_id: serviceId, event_type: eventType, enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.externalNotifications.all, 'templates'] as const });
    },
  });
}

export function useExternalNotificationTemplates() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: [...queryKeys.externalNotifications.all, 'templates'] as const,
    queryFn: () => fetcher<TemplatesResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.TEMPLATES),
  });
}

export function useUpdateExternalNotificationTemplate() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data: { title_template?: string; body_template?: string } }) =>
      fetcher<TemplateResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.TEMPLATE(templateId), {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.services() });
      queryClient.invalidateQueries({ queryKey: queryKeys.externalNotifications.logs() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.externalNotifications.all, 'templates'] as const });
    },
  });
}
