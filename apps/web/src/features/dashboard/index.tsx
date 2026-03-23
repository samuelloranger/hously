import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/PageLayout';
import { StatCard } from './components/StatCard';
import { SmartGreeting } from './components/SmartGreeting';
import { JellyfinLatestShelf } from './components/JellyfinLatestShelf';
import { QbittorrentLiveCard } from './components/QbittorrentLiveCard';
import { ScrutinyHealthCard } from './components/ScrutinyHealthCard';
import { NetdataOverviewCard } from './components/NetdataOverviewCard';
import { AdguardOverviewCard } from './components/AdguardOverviewCard';
import { WeatherWidget } from './components/WeatherWidget';
import { TrackerStatsCard } from './components/TrackerStatsCard';
import { RecentActivityCard } from './components/RecentActivityCard';
import { getUserFirstName, useCurrentUser, useDashboardStats } from '@hously/shared';
import { StatCardSkeleton } from '@/components/Skeleton';
import PendingChoresSection from './components/PendingChoresSection';
import { UpcomingShelf } from './components/UpcomingShelf';
import { CardErrorBoundary } from '@/components/ErrorBoundary';
import { ConversionStatusBar } from '../medias/components/ConversionStatusBar';
import { useConversionJobs } from '@hously/shared';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';
import { PinnedTorrentCard } from './components/PinnedTorrentCard';

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const hasActiveConversions = useConversionJobs().length > 0;
  const torrentsPrefetchIntent = usePrefetchIntent('/torrents');
  const pluginsPrefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });
  const libraryPrefetchIntent = usePrefetchIntent('/library');
  const choresPrefetchIntent = usePrefetchIntent('/chores');

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const stats = statsData?.stats;

  return (
    <PageLayout fullWidth>
      <div className="space-y-5">
        <SmartGreeting
          userName={getUserFirstName(user, t('dashboard.user'))}
          pendingChores={stats?.chores_count || 0}
          shoppingItems={stats?.shopping_count || 0}
          eventsToday={stats?.events_today || 0}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {hasActiveConversions && (
          <CardErrorBoundary>
            <section className="relative overflow-hidden rounded-3xl border border-indigo-300/60 dark:border-indigo-500/30 bg-gradient-to-br from-[#e0e7ff] via-[#a5b4fc] to-[#6366f1] dark:from-indigo-950/70 dark:via-indigo-900/60 dark:to-violet-900/60 p-4 shadow-xl">
              <p className="text-[9px] uppercase tracking-[0.22em] text-indigo-950/70 dark:text-indigo-200/90 mb-1">Conversions</p>
              <h3 className="text-base md:text-lg font-bold text-indigo-950 dark:text-indigo-50 mb-3">Active Jobs</h3>
              <ConversionStatusBar />
            </section>
          </CardErrorBoundary>
        )}

        <CardErrorBoundary>
          <PinnedTorrentCard />
        </CardErrorBoundary>

        <div className="columns-1 md:columns-2 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
          <CardErrorBoundary>
            <WeatherWidget />
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...torrentsPrefetchIntent}>
              <QbittorrentLiveCard />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <TrackerStatsCard />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...libraryPrefetchIntent}>
              <JellyfinLatestShelf />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...libraryPrefetchIntent}>
              <UpcomingShelf />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <NetdataOverviewCard />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <AdguardOverviewCard />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <ScrutinyHealthCard />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <div {...choresPrefetchIntent}>
              <PendingChoresSection />
            </div>
          </CardErrorBoundary>
          <CardErrorBoundary>
            <RecentActivityCard />
          </CardErrorBoundary>
        </div>
      </div>
    </PageLayout>
  );
}
