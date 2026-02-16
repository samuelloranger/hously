import { useTranslation } from 'react-i18next';
import { type Notification, useInfiniteNotifications, useMarkAllAsReadOptimistic } from '@hously/shared';
import { NotificationList } from '../components/NotificationList';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/PageHeader';
import { clearBadge } from '../lib/serviceWorker';

export function Notifications() {
  const { t } = useTranslation('common');
  const limit = 25;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteNotifications(limit);

  const markAllAsReadMutation = useMarkAllAsReadOptimistic();

  // Flatten all pages into a single array
  const notifications: Notification[] = data?.pages?.flatMap(page => page.notifications ?? []) ?? [];

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
    clearBadge();
  };

  const hasUnreadNotifications = notifications.some(notification => !notification.read);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        icon="🔔"
        iconColor="text-blue-600"
        title={t('notifications.title')}
        subtitle={t('notifications.description')}
      />

      {notifications.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button onClick={handleMarkAllAsRead} disabled={!hasUnreadNotifications}>
            {t('notifications.markAllAsRead')}
          </Button>
        </div>
      )}

      <div className="w-full mb-4 flex flex-col items-center justify-between">
        {isLoading ? (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">{t('common.loading')}</div>
        ) : (
          <NotificationList
            notifications={notifications}
            onLoadMore={hasNextPage ? handleLoadMore : undefined}
            hasMore={hasNextPage}
          />
        )}
        {isFetchingNextPage && (
          <div className="text-center py-4 text-neutral-500 dark:text-neutral-400">{t('common.loading')}</div>
        )}
      </div>
    </div>
  );
}
