import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { formatDate, formatTime, type Notification, useDeleteNotification, useMarkAsReadOptimistic } from '@hously/shared';
import { cn } from '../lib/utils';

interface NotificationListProps {
  notifications: Notification[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function NotificationList({ notifications, onLoadMore, hasMore }: NotificationListProps) {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const markAsReadMutation = useMarkAsReadOptimistic();
  const deleteMutation = useDeleteNotification();

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    if (notification.url) {
      navigate({ to: notification.url });
    }
  };

  const handleDelete = async (e: MouseEvent<HTMLButtonElement>, notificationId: number) => {
    e.stopPropagation();
    if (confirm(t('notifications.deleteConfirm'))) {
      await deleteMutation.mutateAsync(notificationId);
    }
  };

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t('notifications.noNotifications')}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            'relative p-4 rounded-lg border cursor-pointer transition-colors',
            notification.read
              ? 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h4
                    className={cn(
                      'text-sm font-medium',
                      notification.read
                        ? 'text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-900 dark:text-neutral-100 font-semibold'
                    )}
                  >
                    {notification.title}
                  </h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{notification.body}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                    {formatDate(notification.created_at, i18n.language || 'en')}{' '}
                    {formatTime(notification.created_at, i18n.language || 'en')}
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
              onClick={e => handleDelete(e, notification.id)}
              className="flex justify-center items-center ml-2 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label={t('notifications.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {hasMore && onLoadMore && (
        <div className="text-center pt-4">
          <button onClick={onLoadMore} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            {t('notifications.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
