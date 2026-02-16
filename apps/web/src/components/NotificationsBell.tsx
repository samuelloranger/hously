import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import {
  queryKeys,
  formatDate,
  formatTime,
  useMarkAllAsReadOptimistic,
  useMarkAsReadOptimistic,
  useNotifications,
  useUnreadCount,
} from '@hously/shared';
import { cn } from '../lib/utils';
import { syncBadge } from '../lib/serviceWorker';
import { useQueryClient } from '@tanstack/react-query';

export function NotificationsMenu() {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread count
  const { data: unreadData } = useUnreadCount();

  // Fetch recent notifications
  const { data: notificationsData } = useNotifications(1, 10);

  const markAsReadMutation = useMarkAsReadOptimistic();

  const markAllAsReadMutation = useMarkAllAsReadOptimistic();

  useEffect(() => {
    if (!isOpen) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1, 10) });
  }, [isOpen, queryClient]);

  const unreadCount = unreadData?.unread_count || 0;
  const recentNotifications = notificationsData?.notifications || [];

  // Listen for service worker messages to update unread count
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NOTIFICATION_COUNT_UPDATE') {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.unreadCount(),
          });
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
    return undefined;
  }, [queryClient]);

  const handleNotificationClick = async (notification: { id: number; read: boolean; url: string | null }) => {
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    setIsOpen(false);
    if (notification.url) {
      navigate({ to: notification.url });
    } else {
      navigate({ to: '/notifications' });
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
    syncBadge();
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex justify-center items-center relative p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg transition-colors"
          aria-label={t('notifications.bell')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 border border-neutral-200 dark:border-neutral-700 max-h-[32rem] overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('notifications.title')}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  disabled={markAllAsReadMutation.isPending}
                >
                  {t('notifications.markAllAsRead')}
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-700 max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                {t('notifications.noNotifications')}
              </div>
            ) : (
              recentNotifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'relative w-full text-left p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors',
                    !notification.read && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          notification.read
                            ? 'text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-900 dark:text-neutral-100 font-semibold'
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        {formatDate(notification.created_at, i18n.language || 'en')}{' '}
                        {formatTime(notification.created_at, i18n.language || 'en')}
                      </p>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="absolute top-[10px] right-[10px]">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* {recentNotifications.length > 0 && ( */}
          <div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate({ to: '/notifications' });
              }}
              className="w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:underline py-2"
            >
              {t('notifications.viewAll')}
            </button>
          </div>
          {/* )} */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
