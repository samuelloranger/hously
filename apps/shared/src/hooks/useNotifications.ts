import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { NOTIFICATION_ENDPOINTS } from '../endpoints';
import type { NotificationsResponse, UnreadCountResponse, ApiResult, NotificationDevicesResponse } from '../types';

export function useNotifications(page: number = 1, limit: number = 20, readFilter?: boolean) {
  const fetcher = useFetcher();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (readFilter !== undefined) {
    params.append('read', readFilter.toString());
  }

  return useQuery({
    queryKey: queryKeys.notifications.list(page, limit, readFilter),
    queryFn: () => fetcher<NotificationsResponse>(`${NOTIFICATION_ENDPOINTS.LIST}?${params.toString()}`),
  });
}

export function useInfiniteNotifications(limit: number = 20, readFilter?: boolean) {
  const fetcher = useFetcher();

  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(1, limit, readFilter),
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        limit: String(limit),
      });
      if (readFilter !== undefined) {
        params.append('read', String(readFilter));
      }
      return fetcher<NotificationsResponse>(`${NOTIFICATION_ENDPOINTS.LIST}?${params.toString()}`);
    },
    getNextPageParam: lastPage => {
      const pagination = lastPage.pagination;
      if (!pagination) return undefined;
      return pagination.page < pagination.pages ? pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useUnreadCount() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => fetcher<UnreadCountResponse>(NOTIFICATION_ENDPOINTS.UNREAD_COUNT),
  });
}

export function useMarkAsRead() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) =>
      fetcher<ApiResult<{ message: string }>>(NOTIFICATION_ENDPOINTS.MARK_READ(notificationId), {
        method: 'PUT',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAsReadOptimistic() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) =>
      fetcher<ApiResult<{ message: string }>>(NOTIFICATION_ENDPOINTS.MARK_READ(notificationId), {
        method: 'PUT',
      }),
    onMutate: async notificationId => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });

      const previousNotifications = queryClient.getQueriesData({ queryKey: queryKeys.notifications.all });

      queryClient.setQueriesData({ queryKey: queryKeys.notifications.all }, (old: any) => {
        if (!old) return old;

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              notifications: (page.notifications || []).map((n: any) =>
                n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
              ),
            })),
          };
        }

        if (Array.isArray(old.notifications)) {
          return {
            ...old,
            notifications: old.notifications.map((n: any) =>
              n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
            ),
          };
        }

        return old;
      });

      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (old: { unread_count: number } | undefined) => {
        if (!old) return { unread_count: 0 };
        return { unread_count: Math.max(0, old.unread_count - 1) };
      });

      return { previousNotifications };
    },
    onError: (_err, _notificationId, context) => {
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]: [readonly unknown[], unknown]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllAsRead() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<ApiResult<{ message: string }>>(NOTIFICATION_ENDPOINTS.MARK_ALL_READ, {
        method: 'PUT',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllAsReadOptimistic() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<ApiResult<{ message: string }>>(NOTIFICATION_ENDPOINTS.MARK_ALL_READ, {
        method: 'PUT',
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });

      const previousNotifications = queryClient.getQueriesData({ queryKey: queryKeys.notifications.all });

      queryClient.setQueriesData({ queryKey: queryKeys.notifications.all }, (old: any) => {
        if (!old) return old;

        const markAsRead = (n: any) => ({
          ...n,
          read: true,
          read_at: n.read_at || new Date().toISOString(),
        });

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              notifications: (page.notifications || []).map(markAsRead),
            })),
          };
        }

        if (Array.isArray(old.notifications)) {
          return {
            ...old,
            notifications: old.notifications.map(markAsRead),
          };
        }

        return old;
      });

      queryClient.setQueryData(queryKeys.notifications.unreadCount(), { unread_count: 0 });

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]: [readonly unknown[], unknown]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
}

export function useDeleteNotification() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) =>
      fetcher<ApiResult<{ message: string }>>(NOTIFICATION_ENDPOINTS.DELETE(notificationId), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useNotificationDevices(
  options?: Omit<UseQueryOptions<NotificationDevicesResponse>, 'queryKey' | 'queryFn'>
) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.notifications.devices(),
    queryFn: () => fetcher<NotificationDevicesResponse>(NOTIFICATION_ENDPOINTS.DEVICES),
    ...options,
  });
}

export function useDeleteNotificationDevice() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: number) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.DELETE_DEVICE(deviceId), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.devices() });
    },
  });
}

export function useRegisterDevice() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: ({ token, platform }: { token: string; platform: string }) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.REGISTER_DEVICE, {
        method: 'POST',
        body: { token, platform },
      }),
  });
}

export function useSendTestNotification() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: () =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.TEST, {
        method: 'POST',
        body: {},
      }),
  });
}

export function useVapidPublicKey() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: [...queryKeys.notifications.all, 'vapid-public-key'] as const,
    queryFn: () => fetcher<{ publicKey: string }>(NOTIFICATION_ENDPOINTS.VAPID_PUBLIC_KEY),
  });
}

export function useSubscribeToPushNotifications() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subscription,
      deviceInfo,
    }: {
      subscription: Record<string, unknown>;
      deviceInfo?: Record<string, unknown>;
    }) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.SUBSCRIBE, {
        method: 'POST',
        body: {
          subscription,
          device_info: deviceInfo,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.devices() });
    },
  });
}

export function useUnsubscribeFromPushNotifications() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscription?: Record<string, unknown>) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.UNSUBSCRIBE, {
        method: 'POST',
        body: { subscription },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.devices() });
    },
  });
}

export function useTestPushNotification() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: () =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.TEST, {
        method: 'POST',
      }),
  });
}
