import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Bell, ArrowRight, CheckCheck, BellOff } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import {
  queryKeys,
  useMarkAllAsReadOptimistic,
  useMarkAsReadOptimistic,
  useNotifications,
  useUnreadCount,
  type NotificationType,
} from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';
import { cn } from '../lib/utils';
import { syncBadge } from '../lib/serviceWorker';
import { useQueryClient } from '@tanstack/react-query';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';

function getRelativeTime(dateStr: string, lang: string): string {
  try {
    const locale = resolveDateFnsLocale(lang);
    return formatRelativeTime(dateStr, { addSuffix: true, locale }) ?? '';
  } catch {
    return '';
  }
}

const typeConfig: Record<NotificationType, { icon: string | React.ReactNode; bg: string }> = {
  reminder: { icon: '⏰', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  external: { icon: '📡', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'app-update': { icon: '✨', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  service_monitor: { icon: '🖥️', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  chore: { icon: '✅', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  shopping: { icon: '🛒', bg: 'bg-sky-100 dark:bg-sky-900/30' },
  recipe: { icon: '🍳', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  event: { icon: '📅', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  system: { icon: '⚙️', bg: 'bg-neutral-100 dark:bg-neutral-700/60' },
};

export function getTypeStyle(notification: { type: NotificationType; metadata?: Record<string, unknown> | null }) {
  if (notification.type === 'external' && notification.metadata?.service_name) {
    const serviceName = notification.metadata.service_name as string;
    if (serviceName === 'radarr') {
      return {
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/radarr.png"
            className="w-[18px] h-[18px] object-contain"
            alt="Radarr"
          />
        ),
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      };
    }
    if (serviceName === 'sonarr') {
      return {
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sonarr.png"
            className="w-[18px] h-[18px] object-contain"
            alt="Sonarr"
          />
        ),
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
      };
    }
  }
  return typeConfig[notification.type] || typeConfig.system;
}

export function NotificationsMenu() {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefetchRoute = usePrefetchRoute();
  const [isOpen, setIsOpen] = useState(false);

  const { data: unreadData } = useUnreadCount();
  const { data: notificationsData } = useNotifications(1, 10);
  const markAsReadMutation = useMarkAsReadOptimistic();
  const markAllAsReadMutation = useMarkAllAsReadOptimistic();

  useEffect(() => {
    if (!isOpen) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1, 10) });
  }, [isOpen, queryClient]);

  const unreadCount = unreadData?.unread_count || 0;
  const recentNotifications = notificationsData?.notifications || [];

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (
          event.data &&
          (event.data.type === 'NOTIFICATION_COUNT_UPDATE' || event.data.type === 'notification-received')
        ) {
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
          className="flex h-9 w-9 items-center justify-center relative rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 transition-colors"
          aria-label={t('notifications.bell')}
          onMouseEnter={() => prefetchRoute('/notifications')}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-[calc(100vw-2rem)] sm:w-[400px] bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200/80 dark:border-neutral-700/60 z-50 max-h-[32rem] overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/60">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('notifications.title')}</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-1.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-50 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.markAllAsRead')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60 mb-3">
                  <BellOff className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                </div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('notifications.noNotifications')}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {recentNotifications.map(notification => {
                  const style = getTypeStyle(notification);
                  const isUnread = !notification.read;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'relative flex items-start gap-3 w-full text-left px-4 py-3 transition-colors',
                        isUnread
                          ? 'bg-primary-50/50 dark:bg-primary-500/10 hover:bg-primary-100/50 dark:hover:bg-primary-500/20'
                          : 'hover:bg-neutral-50 dark:hover:bg-white/[0.05]'
                      )}
                    >
                      {/* Unread left accent */}
                      {isUnread && (
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary-500" />
                      )}

                      {/* Type icon */}
                      <div
                        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm', style.bg)}
                      >
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-[13px] leading-snug',
                            isUnread
                              ? 'font-semibold text-neutral-900 dark:text-white'
                              : 'font-medium text-neutral-700 dark:text-neutral-300'
                          )}
                        >
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p
                            className={cn(
                              'text-xs mt-0.5 line-clamp-2 leading-relaxed',
                              isUnread
                                ? 'text-neutral-600 dark:text-neutral-300'
                                : 'text-neutral-500 dark:text-neutral-400'
                            )}
                          >
                            {notification.body}
                          </p>
                        )}
                        <p
                          className={cn(
                            'text-[11px] mt-1',
                            isUnread
                              ? 'text-neutral-500 dark:text-neutral-400'
                              : 'text-neutral-400 dark:text-neutral-500'
                          )}
                        >
                          {getRelativeTime(notification.created_at, i18n.language || 'en')}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <div className="shrink-0 mt-1.5">
                          <div className="h-2 w-2 rounded-full bg-primary-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-100 dark:border-neutral-700/60">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate({ to: '/notifications' });
              }}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 text-[13px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              {t('notifications.viewAll')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
