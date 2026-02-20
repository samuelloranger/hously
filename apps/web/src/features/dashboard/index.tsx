import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/PageLayout';
import { StatCard } from './components/StatCard';
import { SmartGreeting } from './components/SmartGreeting';
import { JellyfinLatestShelf } from './components/JellyfinLatestShelf';
import { QbittorrentLiveCard } from './components/QbittorrentLiveCard';
import { ScrutinyHealthCard } from './components/ScrutinyHealthCard';
import { NetdataOverviewCard } from './components/NetdataOverviewCard';
import { WeatherWidget } from './components/WeatherWidget';
import { TrackerStatsCard } from './components/TrackerStatsCard';
import { RecentActivityCard } from './components/RecentActivityCard';
import { getUserFirstName, useCurrentUser, useDashboardStats } from '@hously/shared';
import { StatCardSkeleton } from '../../components/Skeleton';
import PendingChoresSection from './components/PendingChoresSection';
import { UpcomingShelf } from './components/UpcomingShelf';
import { usePrefetchRoute } from '../../hooks/usePrefetchRoute';

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const prefetchRoute = usePrefetchRoute();

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const stats = statsData?.stats;

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
            <div
              onMouseEnter={() => prefetchRoute('/torrents')}
              onTouchStart={() => prefetchRoute('/torrents')}
            >
              <QbittorrentLiveCard />
            </div>
            <div
              onMouseEnter={() => prefetchRoute('/medias')}
              onTouchStart={() => prefetchRoute('/medias')}
            >
              <JellyfinLatestShelf />
            </div>
            <div
              onMouseEnter={() => prefetchRoute('/medias')}
              onTouchStart={() => prefetchRoute('/medias')}
            >
              <UpcomingShelf />
            </div>
            <div
              onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
              onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
            >
              <ScrutinyHealthCard />
            </div>
            <div
              onMouseEnter={() => prefetchRoute('/chores')}
              onTouchStart={() => prefetchRoute('/chores')}
            >
              <PendingChoresSection />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div
              onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
              onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
            >
              <TrackerStatsCard />
            </div>
            <div
              onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
              onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
            >
              <NetdataOverviewCard />
            </div>
            <RecentActivityCard />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
