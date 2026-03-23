import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
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
import { usePersistentState } from '@/hooks/usePersistentState';

type DashboardFilter = 'all' | 'life' | 'media' | 'system';
type DashboardLayoutMode = 'masonry' | 'grid';
type DashboardCardId =
  | 'conversions'
  | 'pinned-torrent'
  | 'weather'
  | 'qbittorrent'
  | 'trackers'
  | 'jellyfin'
  | 'upcoming'
  | 'netdata'
  | 'adguard'
  | 'scrutiny'
  | 'pending-chores'
  | 'recent-activity';

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const hasActiveConversions = useConversionJobs().length > 0;
  const torrentsPrefetchIntent = usePrefetchIntent('/torrents');
  const pluginsPrefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });
  const libraryPrefetchIntent = usePrefetchIntent('/library');
  const choresPrefetchIntent = usePrefetchIntent('/chores');
  const [activeFilter, setActiveFilter] = usePersistentState<DashboardFilter>('dashboard-active-filter', 'all');
  const [layoutMode, setLayoutMode] = usePersistentState<DashboardLayoutMode>('dashboard-layout-mode', 'masonry');
  const [highlightedCardId, setHighlightedCardId] = useState<DashboardCardId | null>(null);

  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const stats = statsData?.stats;

  const filterOptions = useMemo(
    () => [
      { id: 'all' as const, label: t('dashboard.controls.all') },
      { id: 'life' as const, label: t('dashboard.controls.life') },
      { id: 'media' as const, label: t('dashboard.controls.media') },
      { id: 'system' as const, label: t('dashboard.controls.system') },
    ],
    [t]
  );

  const dashboardCards = useMemo(() => {
    const cards: Array<{ id: DashboardCardId; category: DashboardFilter; label: string; content: ReactNode }> = [];

    if (hasActiveConversions) {
      cards.push({
        id: 'conversions',
        category: 'media',
        label: t('dashboard.controls.cardLabels.conversions'),
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
        category: 'system',
        label: t('dashboard.controls.cardLabels.pinnedTorrent'),
        content: (
          <CardErrorBoundary>
            <PinnedTorrentCard />
          </CardErrorBoundary>
        ),
      },
      {
        id: 'weather',
        category: 'life',
        label: t('dashboard.controls.cardLabels.weather'),
        content: (
          <CardErrorBoundary>
            <WeatherWidget />
          </CardErrorBoundary>
        ),
      },
      {
        id: 'qbittorrent',
        category: 'system',
        label: t('dashboard.controls.cardLabels.qbittorrent'),
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
        category: 'system',
        label: t('dashboard.controls.cardLabels.trackers'),
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
        category: 'media',
        label: t('dashboard.controls.cardLabels.jellyfin'),
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
        category: 'media',
        label: t('dashboard.controls.cardLabels.upcoming'),
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
        category: 'system',
        label: t('dashboard.controls.cardLabels.netdata'),
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
        category: 'system',
        label: t('dashboard.controls.cardLabels.adguard'),
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
        category: 'system',
        label: t('dashboard.controls.cardLabels.scrutiny'),
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
        category: 'life',
        label: t('dashboard.controls.cardLabels.pendingChores'),
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
        category: 'life',
        label: t('dashboard.controls.cardLabels.recentActivity'),
        content: (
          <CardErrorBoundary>
            <RecentActivityCard />
          </CardErrorBoundary>
        ),
      }
    );

    return cards;
  }, [
    choresPrefetchIntent,
    hasActiveConversions,
    libraryPrefetchIntent,
    pluginsPrefetchIntent,
    torrentsPrefetchIntent,
  ]);

  const visibleCards = useMemo(
    () => dashboardCards.filter(card => activeFilter === 'all' || card.category === activeFilter),
    [activeFilter, dashboardCards]
  );

  const sceneOptions = useMemo(
    () => [
      {
        id: 'home-base',
        emoji: '🏡',
        label: t('dashboard.controls.scenes.homeBase'),
        action: () => {
          setActiveFilter('all');
          setLayoutMode('masonry');
        },
      },
      {
        id: 'focus-home',
        emoji: '🌿',
        label: t('dashboard.controls.scenes.focusHome'),
        action: () => {
          setActiveFilter('life');
          setLayoutMode('grid');
        },
      },
      {
        id: 'media-night',
        emoji: '🎬',
        label: t('dashboard.controls.scenes.mediaNight'),
        action: () => {
          setActiveFilter('media');
          setLayoutMode('grid');
        },
      },
      {
        id: 'ops-scan',
        emoji: '🛠️',
        label: t('dashboard.controls.scenes.opsScan'),
        action: () => {
          setActiveFilter('system');
          setLayoutMode('grid');
        },
      },
    ],
    [setActiveFilter, setLayoutMode, t]
  );

  const spotlightCard = (cardId: DashboardCardId) => {
    const element = document.getElementById(`dashboard-card-${cardId}`);
    if (!element) return;

    setHighlightedCardId(cardId);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSurpriseMe = () => {
    if (visibleCards.length === 0) return;
    const nextCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];
    spotlightCard(nextCard.id);
  };

  useEffect(() => {
    if (!highlightedCardId) return undefined;

    const timeout = window.setTimeout(() => {
      setHighlightedCardId(null);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [highlightedCardId]);

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

        <section className="rounded-3xl border border-neutral-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl dark:border-neutral-700/60 dark:bg-neutral-900/70">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.controls.title')}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('dashboard.controls.showing', { count: visibleCards.length, total: dashboardCards.length })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSurpriseMe}>
                  {t('dashboard.controls.surpriseMe')}
                </Button>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {t('dashboard.controls.surpriseHint')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {sceneOptions.map(scene => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={scene.action}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <span>{scene.emoji}</span>
                  <span>{scene.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="self-center text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
                {t('dashboard.controls.jumpTo')}
              </span>
              {visibleCards.map(card => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => spotlightCard(card.id)}
                  className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  {card.label}
                </button>
              ))}
            </div>

            <div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map(option => (
                  <Button
                    key={option.id}
                    variant={activeFilter === option.id ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setActiveFilter(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
                <Button
                  variant={layoutMode === 'masonry' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLayoutMode('masonry')}
                >
                  {t('dashboard.controls.masonry')}
                </Button>
                <Button
                  variant={layoutMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLayoutMode('grid')}
                >
                  {t('dashboard.controls.grid')}
                </Button>
            </div>
          </div>
        </section>

        {visibleCards.length > 0 ? (
          <div
            className={
              layoutMode === 'grid'
                ? 'grid grid-cols-1 gap-5 xl:grid-cols-2'
                : 'columns-1 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid md:columns-2'
            }
          >
            {visibleCards.map(card => (
              <div
                key={card.id}
                id={`dashboard-card-${card.id}`}
                className={`${layoutMode === 'grid' ? 'h-full' : ''} transition-all duration-500 ${
                  highlightedCardId === card.id ? 'rounded-[2rem] ring-4 ring-indigo-500/40 ring-offset-4 dark:ring-offset-neutral-950' : ''
                }`}
              >
                {card.content}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-white/70 px-6 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
            <p className="text-base font-semibold text-neutral-900 dark:text-white">{t('dashboard.controls.emptyTitle')}</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {t('dashboard.controls.emptyDescription')}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" onClick={() => setActiveFilter('all')}>
                {t('dashboard.controls.resetFilters')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLayoutMode('masonry')}>
                {t('dashboard.controls.masonry')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
