import { useTranslation } from "react-i18next";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationsApi } from "../features/notifications/api";
import { queryKeys } from "../lib/queryKeys";
import { NotificationList } from "../components/NotificationList";
import type { Notification } from "../types/entities";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../components/PageHeader";
import { clearBadge } from "../lib/serviceWorker";

export function Notifications() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const limit = 25;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.notifications.list(1, limit),
      queryFn: ({ pageParam = 1 }) =>
        notificationsApi.getNotifications(pageParam, limit),
      getNextPageParam: (lastPage) => {
        const { pagination } = lastPage;
        return pagination.page < pagination.pages
          ? pagination.page + 1
          : undefined;
      },
      initialPageParam: 1,
    });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      const previousNotifications = queryClient.getQueriesData({
        queryKey: queryKeys.notifications.all,
      });

      // Optimistically mark all notifications as read
      queryClient.setQueriesData(
        { queryKey: queryKeys.notifications.all },
        (old: any) => {
          if (!old) return old;

          const markAsRead = (n: Notification) => ({
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
        }
      );

      // Optimistically set unread count to 0
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), {
        unread_count: 0,
      });

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      clearBadge();
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
  });

  // Flatten all pages into a single array
  const notifications: Notification[] =
    data?.pages?.flatMap((page) => page.notifications ?? []) ?? [];

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
  };

  const hasUnreadNotifications = notifications.some(
    (notification) => !notification.read
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        icon="🔔"
        iconColor="text-blue-600"
        title={t("notifications.title")}
        subtitle={t("notifications.description")}
      />

      {notifications.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={handleMarkAllAsRead}
            disabled={!hasUnreadNotifications}
          >
            {t("notifications.markAllAsRead")}
          </Button>
        </div>
      )}

      <div className="w-full mb-4 flex flex-col items-center justify-between">
        {isLoading ? (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            {t("common.loading")}
          </div>
        ) : (
          <NotificationList
            notifications={notifications}
            onLoadMore={hasNextPage ? handleLoadMore : undefined}
            hasMore={hasNextPage}
          />
        )}
        {isFetchingNextPage && (
          <div className="text-center py-4 text-neutral-500 dark:text-neutral-400">
            {t("common.loading")}
          </div>
        )}
      </div>
    </div>
  );
}
