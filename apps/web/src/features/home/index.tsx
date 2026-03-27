import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { CalendarDays, ShoppingCart, CheckSquare2, Flame } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { type DashboardStats, getUserFirstName, useCurrentUser, useDashboardStats } from '@hously/shared';
import { CardErrorBoundary } from '@/components/ErrorBoundary';
import { GreetingCard } from './components/GreetingCard';
import { DownloadsPanel } from './components/DownloadsPanel';
import { WeatherPanel } from './components/WeatherPanel';
import { SystemPanel } from './components/SystemPanel';
import { JellyfinShelf, UpcomingShelf } from './components/MediaShelves';
import { TrackersPanel } from './components/TrackersPanel';
import { ChoresPanel, HabitsPanel } from './components/HomePanel';

// ─── Styles injected once ─────────────────────────────────────────────────────

const STYLES = `
  @keyframes homeSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .home-enter {
    animation: homeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .home-poster-card {
    animation: homeSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
`;

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats?: DashboardStats }) {
  const { t } = useTranslation('common');
  if (!stats) return null;

  const chips = [
    {
      href: '/calendar' as const,
      icon: <CalendarDays size={11} />,
      value: stats.events_today,
      label: t('dashboard.home.statsEventsToday', { count: stats.events_today }),
      color: 'hover:text-amber-600 dark:hover:text-amber-400',
    },
    {
      href: '/chores' as const,
      icon: <CheckSquare2 size={11} />,
      value: stats.chores_count,
      label: t('dashboard.home.statsChores', { count: stats.chores_count }),
      color: 'hover:text-emerald-600 dark:hover:text-emerald-400',
    },
    {
      href: '/shopping' as const,
      icon: <ShoppingCart size={11} />,
      value: stats.shopping_count,
      label: t('dashboard.home.statsShopping', { count: stats.shopping_count }),
      color: 'hover:text-blue-600 dark:hover:text-blue-400',
    },
  ].filter(c => c.value > 0);

  const streak = stats.habits_streak;

  if (chips.length === 0 && !streak) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {chips.map(chip => (
        <Link
          key={chip.href}
          to={chip.href}
          className={`flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 transition-colors ${chip.color}`}
        >
          {chip.icon}
          <span className="font-mono font-semibold tabular-nums">{chip.value}</span>
          <span>{chip.label}</span>
        </Link>
      ))}
      {streak > 0 && (
        <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Flame size={11} className="text-orange-400" />
          <span className="font-mono font-semibold tabular-nums text-orange-500">
            {t('dashboard.home.streakDays', { count: streak })}
          </span>
          <span>{t('dashboard.home.streakLabel')}</span>
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HomePage() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const { data: statsData } = useDashboardStats();
  const stats = statsData?.stats;

  return (
    <PageLayout fullWidth>
      <style>{STYLES}</style>

      <div className="space-y-6">
        {/* Main layout: left stacked widgets / right tall column */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          {/* Left: stacked widgets */}
          <div className="min-w-0 space-y-4">
            <div className="home-enter space-y-3" style={{ animationDelay: '0ms' }}>
              <GreetingCard
                userName={getUserFirstName(user, t('dashboard.user'))}
                pendingChores={stats?.chores_count || 0}
                shoppingItems={stats?.shopping_count || 0}
                eventsToday={stats?.events_today || 0}
              />
              <StatsRow stats={stats} />
            </div>

            <div className="home-enter" style={{ animationDelay: '60ms' }}>
              <CardErrorBoundary>
                <JellyfinShelf />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '100ms' }}>
              <CardErrorBoundary>
                <UpcomingShelf />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '140ms' }}>
              <CardErrorBoundary>
                <HabitsPanel />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '180ms' }}>
              <CardErrorBoundary>
                <ChoresPanel />
              </CardErrorBoundary>
            </div>
          </div>

          {/* Right: weather + system + downloads + trackers */}
          <div className="space-y-4">
            <div className="home-enter" style={{ animationDelay: '60ms' }}>
              <CardErrorBoundary>
                <WeatherPanel />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '100ms' }}>
              <CardErrorBoundary>
                <SystemPanel />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '140ms' }}>
              <CardErrorBoundary>
                <DownloadsPanel />
              </CardErrorBoundary>
            </div>

            <div className="home-enter" style={{ animationDelay: '180ms' }}>
              <CardErrorBoundary>
                <TrackersPanel />
              </CardErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
