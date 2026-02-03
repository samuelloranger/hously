import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import type { Notification } from "../types/entities";
import { notificationsApi } from "../features/notifications/api";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { formatDate, formatTime } from "../lib/date-utils";

interface NotificationListProps {
  notifications: Notification[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function NotificationList({
  notifications,
  onLoadMore,
  hasMore,
}: NotificationListProps) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData({
        queryKey: queryKeys.notifications.all,
      });

      // Optimistically update all notification queries
      queryClient.setQueriesData(
        { queryKey: queryKeys.notifications.all },
        (old: any) => {
          if (!old) return old;

          // Handle paginated responses
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                notifications: (page.notifications || []).map((n: Notification) =>
                  n.id === notificationId
                    ? { ...n, read: true, read_at: new Date().toISOString() }
                    : n
                ),
              })),
            };
          }

          // Handle array responses
          if (Array.isArray(old.notifications)) {
            return {
              ...old,
              notifications: old.notifications.map((n: Notification) =>
                n.id === notificationId
                  ? { ...n, read: true, read_at: new Date().toISOString() }
                  : n
              ),
            };
          }

          return old;
        }
      );

      // Optimistically update unread count
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(),
        (old: { unread_count: number } | undefined) => {
          if (!old) return { unread_count: 0 };
          return { unread_count: Math.max(0, old.unread_count - 1) };
        }
      );

      return { previousNotifications };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Invalidate to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notificationsApi.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    if (notification.url) {
      navigate({ to: notification.url });
    }
  };

  const handleDelete = async (
    e: MouseEvent<HTMLButtonElement>,
    notificationId: number
  ) => {
    e.stopPropagation();
    if (confirm(t("notifications.deleteConfirm"))) {
      await deleteMutation.mutateAsync(notificationId);
    }
  };

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("notifications.noNotifications")}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            "relative p-4 rounded-lg border cursor-pointer transition-colors",
            notification.read
              ? "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h4
                    className={cn(
                      "text-sm font-medium",
                      notification.read
                        ? "text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-900 dark:text-neutral-100 font-semibold"
                    )}
                  >
                    {notification.title}
                  </h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {notification.body}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                    {formatDate(notification.created_at, i18n.language || "en")}{" "}
                    {formatTime(notification.created_at, i18n.language || "en")}
                  </p>
                </div>
                {!notification.read && (
                  <div className="absolute top-[10px] right-[10px]">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(e, notification.id)}
              className="flex justify-center items-center ml-2 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label={t("notifications.delete")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {hasMore && onLoadMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t("notifications.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
