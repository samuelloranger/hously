import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/PageLayout';
import { StatCard } from './components/StatCard';
import { SmartGreeting } from './components/SmartGreeting';
import { JellyfinLatestShelf } from './components/JellyfinLatestShelf';
import { UpcomingShelf } from './components/UpcomingShelf';
import { QbittorrentLiveCard } from './components/QbittorrentLiveCard';
import { ScrutinyHealthCard } from './components/ScrutinyHealthCard';
import { NetdataOverviewCard } from './components/NetdataOverviewCard';
import { WeatherWidget } from './components/WeatherWidget';
import { TrackerStatsCard } from './components/TrackerStatsCard';
import { RecentActivityCard } from './components/RecentActivityCard';
import { EmptyState } from '../../components/EmptyState';
import {
  getUserFirstName,
  useCurrentUser,
  useDashboardStats,
  useDashboardJellyfinLatestInfinite,
  useDashboardUpcoming,
  useChores,
} from '@hously/shared';
import { useMemo } from 'react';
import { ChoreRow } from '../chores/components/ChoreRow';
import { StatCardSkeleton, ListItemSkeleton } from '../../components/Skeleton';

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
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
    refetch: refetchUpcoming,
  } = useDashboardUpcoming();
  const { data: choresData, isLoading: choresLoading } = useChores();

  const stats = statsData?.stats;
  const chores = choresData?.chores || [];
  const users = choresData?.users || [];
  const pendingChores = chores.filter(chore => !chore.completed);
  const jellyfinItems = useMemo(() => {
    const seen = new Set<string>();
    return (
      jellyfinData?.pages
        .flatMap(p => p.items)
        .filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }) ?? []
    );
  }, [jellyfinData?.pages]);
  const upcomingItems = upcomingData?.items ?? [];
  const jellyfinEnabled = jellyfinData?.pages[0]?.enabled ?? false;
  const upcomingEnabled = upcomingData?.enabled ?? false;
  const radarrEnabled = upcomingData?.radarr_enabled ?? false;
  const sonarrEnabled = upcomingData?.sonarr_enabled ?? false;

  return (
    <PageLayout>
      <div className="space-y-6">
        <SmartGreeting
          userName={getUserFirstName(user, t('dashboard.user'))}
          pendingChores={stats?.chores_count || 0}
          shoppingItems={stats?.shopping_count || 0}
          eventsToday={stats?.events_today || 0}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <WeatherWidget />
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
            <QbittorrentLiveCard />
            <ScrutinyHealthCard />
            <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
              <div className="px-6 py-4 flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-700/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 text-sm">
                    ✅
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {t('dashboard.pendingChores')}
                  </h3>
                </div>
                {pendingChores.length > 5 && (
                  <a
                    href="/chores"
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {t('dashboard.view')} ({pendingChores.length})
                  </a>
                )}
              </div>
              <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/50">
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
            </section>
          </div>
          <div className="flex flex-col gap-6">
            <UpcomingShelf
              enabled={upcomingEnabled}
              radarrEnabled={radarrEnabled}
              sonarrEnabled={sonarrEnabled}
              items={upcomingItems}
              isLoading={upcomingLoading}
              isRefreshing={upcomingFetching && !upcomingLoading}
              onRefresh={() => {
                void refetchUpcoming();
              }}
            />
            <TrackerStatsCard />
            <NetdataOverviewCard />
            <RecentActivityCard />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
