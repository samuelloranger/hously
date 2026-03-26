import { useMemo, type ReactNode } from 'react';
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
import { getUserFirstName, useCurrentUser, useDashboardStats } from '@hously/shared';
import { StatCardSkeleton } from '@/components/Skeleton';
import PendingChoresSection from './components/PendingChoresSection';
import { UpcomingShelf } from './components/UpcomingShelf';
import { CardErrorBoundary } from '@/components/ErrorBoundary';
import { ConversionStatusBar } from '../medias/components/ConversionStatusBar';
import { useConversionJobs } from '@hously/shared';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';
import { PinnedTorrentCard } from './components/PinnedTorrentCard';
import { ViewSwitcher } from '../v2/components/ViewSwitcher';

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

  const dashboardCards = useMemo(() => {
    const cards: Array<{ id: string; content: ReactNode }> = [];

    if (hasActiveConversions) {
      cards.push({
        id: 'conversions',
        content: (
          <CardErrorBoundary>
            <section className="relative overflow-hidden rounded-3xl border border-indigo-300/60 bg-gradient-to-br from-[#e0e7ff] via-[#a5b4fc] to-[#6366f1] p-4 shadow-xl dark:border-indigo-500/30 dark:from-indigo-950/70 dark:via-indigo-900/60 dark:to-violet-900/60">
              <p className="mb-1 text-[9px] uppercase tracking-[0.22em] text-indigo-950/70 dark:text-indigo-200/90">
                Conversions
              </p>
              <h3 className="mb-3 text-base font-bold text-indigo-950 dark:text-indigo-50 md:text-lg">Active Jobs</h3>
              <ConversionStatusBar />
            </section>
          </CardErrorBoundary>
        ),
      });
    }

    cards.push(
      {
        id: 'pinned-torrent',
        content: (
          <CardErrorBoundary>
            <PinnedTorrentCard />
          </CardErrorBoundary>
        ),
      },
      {
        id: 'weather',
        content: (
          <CardErrorBoundary>
            <WeatherWidget />
          </CardErrorBoundary>
        ),
      },
      {
        id: 'qbittorrent',
        content: (
          <CardErrorBoundary>
            <div {...torrentsPrefetchIntent}>
              <QbittorrentLiveCard />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'trackers',
        content: (
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <TrackerStatsCard />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'jellyfin',
        content: (
          <CardErrorBoundary>
            <div {...libraryPrefetchIntent}>
              <JellyfinLatestShelf />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'upcoming',
        content: (
          <CardErrorBoundary>
            <div {...libraryPrefetchIntent}>
              <UpcomingShelf />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'netdata',
        content: (
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <NetdataOverviewCard />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'adguard',
        content: (
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <AdguardOverviewCard />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'scrutiny',
        content: (
          <CardErrorBoundary>
            <div {...pluginsPrefetchIntent}>
              <ScrutinyHealthCard />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'pending-chores',
        content: (
          <CardErrorBoundary>
            <div {...choresPrefetchIntent}>
              <PendingChoresSection />
            </div>
          </CardErrorBoundary>
        ),
      },
      {
        id: 'recent-activity',
        content: null,
      }
    );

    return cards.filter((card): card is { id: string; content: ReactNode } => card.content !== null);
  }, [
    choresPrefetchIntent,
    hasActiveConversions,
    libraryPrefetchIntent,
    pluginsPrefetchIntent,
    torrentsPrefetchIntent,
  ]);

  return (
    <PageLayout fullWidth>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <SmartGreeting
            userName={getUserFirstName(user, t('dashboard.user'))}
            pendingChores={stats?.chores_count || 0}
            shoppingItems={stats?.shopping_count || 0}
            eventsToday={stats?.events_today || 0}
          />
          <ViewSwitcher className="mt-1 shrink-0" />
        </div>

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

        <div className="columns-1 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid md:columns-2">
          {dashboardCards.map(card => (
            <div key={card.id}>{card.content}</div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
