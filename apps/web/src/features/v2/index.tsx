import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { CalendarDays, ShoppingCart, CheckSquare2, Flame } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import {
  getUserFirstName,
  useCurrentUser,
  useDashboardStats,
} from '@hously/shared';
import { CardErrorBoundary } from '@/components/ErrorBoundary';
import { ViewSwitcher } from './components/ViewSwitcher';
import { DownloadsPanel } from './components/DownloadsPanel';
import { SystemPanel } from './components/SystemPanel';
import { JellyfinShelf, UpcomingShelf } from './components/MediaShelves';
import { TrackersPanel } from './components/TrackersPanel';
import { ChoresPanel, HabitsPanel, ActivityPanel } from './components/HomePanel';

// ─── Styles injected once ─────────────────────────────────────────────────────

const STYLES = `
  @keyframes v2SlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .v2-enter {
    animation: v2SlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .v2-poster-card {
    animation: v2SlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
`;

// ─── Header ───────────────────────────────────────────────────────────────────

function V2Header() {
  const { i18n } = useTranslation('common');
  const { data: user } = useCurrentUser();

  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const greeting =
      h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

    const dateLabel = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(now);

    return { greeting, dateLabel };
  }, [i18n.language]);

  const firstName = getUserFirstName(user, '');

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-1">
          {dateLabel}
        </p>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">
          {greeting}
          {firstName ? (
            <>
              ,{' '}
              <span className="font-semibold">{firstName}</span>
            </>
          ) : null}
        </h1>
      </div>
      <ViewSwitcher className="mt-1 shrink-0" />
    </div>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow() {
  const { data: statsData } = useDashboardStats();
  const stats = statsData?.stats;

  if (!stats) return null;

  const chips = [
    {
      href: '/calendar' as const,
      icon: <CalendarDays size={11} />,
      value: stats.events_today,
      label: stats.events_today === 1 ? 'event today' : 'events today',
      color: 'hover:text-amber-600 dark:hover:text-amber-400',
    },
    {
      href: '/chores' as const,
      icon: <CheckSquare2 size={11} />,
      value: stats.chores_count,
      label: stats.chores_count === 1 ? 'chore' : 'chores',
      color: 'hover:text-emerald-600 dark:hover:text-emerald-400',
    },
    {
      href: '/shopping' as const,
      icon: <ShoppingCart size={11} />,
      value: stats.shopping_count,
      label: stats.shopping_count === 1 ? 'item to buy' : 'items to buy',
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
          <span className="font-mono font-semibold tabular-nums text-orange-500">{streak}d</span>
          <span>streak</span>
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function V2Page() {
  return (
    <PageLayout fullWidth>
      <style>{STYLES}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="v2-enter" style={{ animationDelay: '0ms' }}>
          <V2Header />
          <div className="mt-3">
            <StatsRow />
          </div>
        </div>

        {/* Main 2-column bento: downloads + system */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          <div
            className="v2-enter space-y-4"
            style={{ animationDelay: '60ms' }}
          >
            <CardErrorBoundary>
              <DownloadsPanel />
            </CardErrorBoundary>
          </div>

          <div
            className="v2-enter"
            style={{ animationDelay: '100ms' }}
          >
            <CardErrorBoundary>
              <SystemPanel />
            </CardErrorBoundary>
          </div>
        </div>

        {/* Media shelves */}
        <div
          className="v2-enter space-y-4"
          style={{ animationDelay: '150ms' }}
        >
          <CardErrorBoundary>
            <JellyfinShelf />
          </CardErrorBoundary>

          <CardErrorBoundary>
            <UpcomingShelf />
          </CardErrorBoundary>
        </div>

        {/* Trackers — full width */}
        <div className="v2-enter" style={{ animationDelay: '200ms' }}>
          <CardErrorBoundary>
            <TrackersPanel />
          </CardErrorBoundary>
        </div>

        {/* Home section: chores (2/3) + habits + activity (1/3) */}
        <div
          className="v2-enter grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 items-start"
          style={{ animationDelay: '240ms' }}
        >
          <CardErrorBoundary>
            <ChoresPanel />
          </CardErrorBoundary>

          <div className="space-y-4">
            <CardErrorBoundary>
              <HabitsPanel />
            </CardErrorBoundary>
            <CardErrorBoundary>
              <ActivityPanel />
            </CardErrorBoundary>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
