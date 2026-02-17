import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/PageLayout';
import { StatCard } from './components/StatCard';
import { SmartGreeting } from './components/SmartGreeting';
import { JellyfinLatestShelf } from './components/JellyfinLatestShelf';
import { UpcomingShelf } from './components/UpcomingShelf';
import { QbittorrentLiveCard } from './components/QbittorrentLiveCard';
import { ScrutinyHealthCard } from './components/ScrutinyHealthCard';
import { EmptyState } from '../../components/EmptyState';
import {
  getUserFirstName,
  useCurrentUser,
  useDashboardStats,
  useDashboardActivities,
  useDashboardJellyfinLatestInfinite,
  useDashboardUpcomingInfinite,
  useChores,
} from '@hously/shared';
import { useMemo } from 'react';
import { ChoreRow } from '../chores/components/ChoreRow';
import { StatCardSkeleton, ListItemSkeleton } from '../../components/Skeleton';

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const { data: activitiesData, isLoading: activitiesLoading } = useDashboardActivities();
  const {
    data: jellyfinData,
    isLoading: jellyfinLoading,
    isFetching: jellyfinFetching,
    isFetchingNextPage: jellyfinLoadingMore,
    hasNextPage: jellyfinHasMore,
    fetchNextPage: fetchNextJellyfin,
    refetch: refetchJellyfin,
  } = useDashboardJellyfinLatestInfinite(10);
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    isFetching: upcomingFetching,
    isFetchingNextPage: upcomingLoadingMore,
    hasNextPage: upcomingHasMore,
    fetchNextPage: fetchNextUpcoming,
    refetch: refetchUpcoming,
  } = useDashboardUpcomingInfinite(24);
  const { data: choresData, isLoading: choresLoading } = useChores();

  const stats = statsData?.stats;
  const activities = activitiesData?.activities || [];
  const chores = choresData?.chores || [];
  const users = choresData?.users || [];
  const pendingChores = chores.filter(chore => !chore.completed);
  const jellyfinItems = useMemo(() => jellyfinData?.pages.flatMap(page => page.items) ?? [], [jellyfinData?.pages]);
  const upcomingItems = useMemo(() => upcomingData?.pages.flatMap(page => page.items) ?? [], [upcomingData?.pages]);
  const jellyfinEnabled = jellyfinData?.pages[0]?.enabled ?? false;
  const upcomingEnabled = upcomingData?.pages[0]?.enabled ?? false;
  const radarrEnabled = upcomingData?.pages[0]?.radarr_enabled ?? false;
  const sonarrEnabled = upcomingData?.pages[0]?.sonarr_enabled ?? false;

  return (
    <PageLayout>
      <SmartGreeting
        userName={getUserFirstName(user, t('dashboard.user'))}
        pendingChores={stats?.chores_count || 0}
        shoppingItems={stats?.shopping_count || 0}
        eventsToday={stats?.events_today || 0}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon="📆"
              title={t('dashboard.eventsToday')}
              value={stats?.events_today || 0}
              color="text-black dark:text-white"
              link="/calendar"
              t={t}
              index={0}
            />
            <StatCard
              icon="🛒"
              title={t('dashboard.shoppingItems')}
              value={stats?.shopping_count || 0}
              color="text-blue-600"
              link="/shopping"
              t={t}
              index={1}
            />
            <StatCard
              icon="✅"
              title={t('dashboard.pendingChores')}
              value={stats?.chores_count || 0}
              color="text-green-600"
              link="/chores"
              t={t}
              index={2}
            />
          </>
        )}
      </div>

      {/** <Analytics /> */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <JellyfinLatestShelf
          enabled={jellyfinEnabled}
          items={jellyfinItems}
          isLoading={jellyfinLoading}
          isRefreshing={jellyfinFetching && !jellyfinLoading}
          isLoadingMore={jellyfinLoadingMore}
          hasMore={Boolean(jellyfinHasMore)}
          onLoadMore={() => {
            if (jellyfinHasMore && !jellyfinLoadingMore) {
              void fetchNextJellyfin();
            }
          }}
          onRefresh={() => {
            void refetchJellyfin();
          }}
        />

        <UpcomingShelf
          enabled={upcomingEnabled}
          radarrEnabled={radarrEnabled}
          sonarrEnabled={sonarrEnabled}
          items={upcomingItems}
          isLoading={upcomingLoading}
          isRefreshing={upcomingFetching && !upcomingLoading}
          isLoadingMore={upcomingLoadingMore}
          hasMore={Boolean(upcomingHasMore)}
          onLoadMore={() => {
            if (upcomingHasMore && !upcomingLoadingMore) {
              void fetchNextUpcoming();
            }
          }}
          onRefresh={() => {
            void refetchUpcoming();
          }}
        />
      </div>

      <div className="mt-4 mb-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
        <QbittorrentLiveCard />
        <ScrutinyHealthCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-neutral-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">{t('dashboard.pendingChores')}</h3>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {choresLoading ? (
              <div className="p-4 space-y-2">
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </div>
            ) : pendingChores.length > 0 ? (
              pendingChores.slice(0, 5).map(chore => <ChoreRow key={chore.id} chore={chore} users={users} />)
            ) : (
              <div className="p-6">
                <EmptyState icon="✅" title={t('chores.noChores')} description={t('chores.addFirstChore')} />
              </div>
            )}
          </div>
          {pendingChores.length > 5 && (
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
              <a href="/chores" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                {t('dashboard.view')} ({pendingChores.length})
              </a>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-neutral-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">{t('dashboard.recentActivity')}</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {activitiesLoading ? (
                <>
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                </>
              ) : activities.length > 0 ? (
                activities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className="text-neutral-400">{activity.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-900 dark:text-white">{activity.description}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl text-neutral-300 dark:text-neutral-600 mb-4 block">⏰</span>
                  <p className="text-neutral-500 dark:text-neutral-400">{t('dashboard.noRecentActivity')}</p>
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">{t('dashboard.startUsing')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
