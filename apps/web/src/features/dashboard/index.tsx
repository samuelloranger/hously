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
import { EmptyState } from '../../components/EmptyState';
import {
  type DashboardCardConfig,
  type DashboardCardSize,
  type DashboardConfigV1,
  getUserFirstName,
  useCurrentUser,
  useDashboardStats,
  useDashboardActivities,
  useDashboardJellyfinLatestInfinite,
  useDashboardUpcomingInfinite,
  useChores,
  useUpdateProfile,
} from '@hously/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ChoreRow } from '../chores/components/ChoreRow';
import { StatCardSkeleton, ListItemSkeleton } from '../../components/Skeleton';

type DashboardCardId = 'jellyfin' | 'upcoming' | 'qbittorrent' | 'scrutiny' | 'netdata' | 'chores' | 'activity';

const DEFAULT_DASHBOARD_CARDS: DashboardCardConfig[] = [
  { id: 'jellyfin', size: 'half' },
  { id: 'upcoming', size: 'half' },
  { id: 'qbittorrent', size: 'half' },
  { id: 'scrutiny', size: 'half' },
  { id: 'netdata', size: 'full' },
  { id: 'chores', size: 'half' },
  { id: 'activity', size: 'half' },
];

function mergeDashboardCards(profile: DashboardConfigV1 | null | undefined): DashboardCardConfig[] {
  const defaultsById = new Map(DEFAULT_DASHBOARD_CARDS.map(card => [card.id, card] as const));
  const result: DashboardCardConfig[] = [];
  const seen = new Set<string>();

  const rawCards = profile?.version === 1 ? profile.cards : [];
  for (const entry of rawCards) {
    const id = typeof entry?.id === 'string' ? entry.id : '';
    if (!defaultsById.has(id)) continue;
    if (seen.has(id)) continue;
    const size: DashboardCardSize = entry.size === 'full' ? 'full' : 'half';
    result.push({ id, size });
    seen.add(id);
  }

  for (const fallback of DEFAULT_DASHBOARD_CARDS) {
    if (seen.has(fallback.id)) continue;
    result.push(fallback);
  }

  return result;
}

function moveCard(cards: DashboardCardConfig[], activeId: string, overId: string): DashboardCardConfig[] {
  if (activeId === overId) return cards;
  const fromIndex = cards.findIndex(card => card.id === activeId);
  const toIndex = cards.findIndex(card => card.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return cards;
  const next = [...cards];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function setCardSize(cards: DashboardCardConfig[], id: string, size: DashboardCardSize): DashboardCardConfig[] {
  const next = cards.map(card => (card.id === id ? { ...card, size } : card));
  return next;
}

function buildDashboardConfig(cards: DashboardCardConfig[]): DashboardConfigV1 {
  return { version: 1, cards: cards.map(card => ({ id: card.id, size: card.size })) };
}

function DashboardCardFrame({
  card,
  isEditing,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onToggleSize,
  onResizeSize,
  children,
}: {
  card: DashboardCardConfig;
  isEditing: boolean;
  draggingId: string | null;
  onDragStart: (id: string) => (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOverCard: (id: string) => (event: React.DragEvent) => void;
  onToggleSize: (id: string) => void;
  onResizeSize: (id: string, size: DashboardCardSize) => void;
  children: React.ReactNode;
}) {
  const resizeStartRef = useRef<{ x: number; size: DashboardCardSize } | null>(null);

  const beginResize = (event: React.PointerEvent) => {
    if (!isEditing) return;
    resizeStartRef.current = { x: event.clientX, size: card.size };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onResizeMove = (event: React.PointerEvent) => {
    if (!isEditing) return;
    const start = resizeStartRef.current;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    if (deltaX > 40 && card.size !== 'full') {
      onResizeSize(card.id, 'full');
    } else if (deltaX < -40 && card.size !== 'half') {
      onResizeSize(card.id, 'half');
    }
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const isDragging = draggingId === card.id;
  const spanClass = card.size === 'full' ? 'lg:col-span-2' : 'lg:col-span-1';

  return (
    <div
      className={`relative ${spanClass} ${isEditing ? 'ring-1 ring-neutral-900/10 dark:ring-white/10 rounded-3xl' : ''} ${
        isDragging ? 'opacity-60' : ''
      }`}
      onDragOver={onDragOverCard(card.id)}
      onDrop={onDragEnd}
    >
      {isEditing ? (
        <>
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={onDragStart(card.id)}
              onDragEnd={onDragEnd}
              className="inline-flex items-center justify-center rounded-full border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-200 cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              ⋮⋮
            </button>
            <button
              type="button"
              onClick={() => onToggleSize(card.id)}
              className="inline-flex items-center justify-center rounded-full border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200"
              aria-label="Toggle card size"
              title="Toggle card size"
            >
              {card.size === 'full' ? '100%' : '50%'}
            </button>
          </div>
          <div
            className="absolute bottom-4 right-4 z-20 h-7 w-7 rounded-full border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/30 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-ew-resize select-none"
            role="slider"
            aria-label="Resize card"
            aria-valuetext={card.size}
            tabIndex={0}
            onPointerDown={beginResize}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onDoubleClick={() => onToggleSize(card.id)}
            title="Drag left/right to resize"
          >
            ↔
          </div>
        </>
      ) : null}

      <div className={isEditing ? 'pointer-events-none select-none' : ''}>{children}</div>
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();
  const updateProfileMutation = useUpdateProfile();

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

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dashboardCards, setDashboardCards] = useState<DashboardCardConfig[]>(DEFAULT_DASHBOARD_CARDS);

  const baselineConfigRef = useRef<string>(JSON.stringify(buildDashboardConfig(DEFAULT_DASHBOARD_CARDS)));
  const hasHydratedLayoutRef = useRef(false);

  const currentConfigString = useMemo(
    () => JSON.stringify(buildDashboardConfig(dashboardCards)),
    [dashboardCards]
  );
  const isDirty = currentConfigString !== baselineConfigRef.current;

  useEffect(() => {
    if (!user) return;
    const merged = mergeDashboardCards(user.dashboard_config ?? null);
    const nextConfig = buildDashboardConfig(merged);
    const nextBaseline = JSON.stringify(nextConfig);

    if (!hasHydratedLayoutRef.current) {
      setDashboardCards(merged);
      baselineConfigRef.current = nextBaseline;
      hasHydratedLayoutRef.current = true;
      return;
    }

    // Avoid clobbering local layout changes while saving or after leaving edit mode.
    if (isEditingLayout || updateProfileMutation.isPending) return;
    if (nextBaseline === baselineConfigRef.current) return;
    if (currentConfigString !== baselineConfigRef.current) return;

    setDashboardCards(merged);
    baselineConfigRef.current = nextBaseline;
  }, [user?.id, user?.dashboard_config, isEditingLayout, updateProfileMutation.isPending, currentConfigString]);

  const scheduleSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    if (!isEditingLayout) return;
    if (!isDirty) return;

    if (scheduleSaveRef.current) clearTimeout(scheduleSaveRef.current);
    scheduleSaveRef.current = setTimeout(() => {
      updateProfileMutation.mutate(
        { dashboard_config: buildDashboardConfig(dashboardCards) },
        {
          onSuccess: response => {
            baselineConfigRef.current = JSON.stringify(buildDashboardConfig(mergeDashboardCards(response.user?.dashboard_config ?? null)));
          },
        }
      );
    }, 650);

    return () => {
      if (scheduleSaveRef.current) clearTimeout(scheduleSaveRef.current);
    };
  }, [dashboardCards, isDirty, isEditingLayout, updateProfileMutation, user]);

  const saveNow = () => {
    if (!user) return;
    updateProfileMutation.mutate(
      { dashboard_config: buildDashboardConfig(dashboardCards) },
      {
        onSuccess: response => {
          baselineConfigRef.current = JSON.stringify(buildDashboardConfig(mergeDashboardCards(response.user?.dashboard_config ?? null)));
        },
      }
    );
  };

  const onDragStart = (id: string) => (event: React.DragEvent) => {
    if (!isEditingLayout) return;
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const onDragEnd = () => {
    setDraggingId(null);
  };

  const onDragOverCard = (overId: string) => (event: React.DragEvent) => {
    if (!isEditingLayout) return;
    event.preventDefault();
    const activeId = draggingId || event.dataTransfer.getData('text/plain');
    if (!activeId) return;
    setDashboardCards(prev => moveCard(prev, activeId, overId));
  };

  const toggleCardSize = (id: string) => {
    setDashboardCards(prev => {
      const current = prev.find(card => card.id === id)?.size ?? 'half';
      const nextSize: DashboardCardSize = current === 'full' ? 'half' : 'full';
      return setCardSize(prev, id, nextSize);
    });
  };

  const resizeCard = (id: string, size: DashboardCardSize) => {
    setDashboardCards(prev => setCardSize(prev, id, size));
  };

  const resetLayout = () => {
    setDashboardCards(DEFAULT_DASHBOARD_CARDS);
    if (!user) return;
    updateProfileMutation.mutate(
      { dashboard_config: buildDashboardConfig(DEFAULT_DASHBOARD_CARDS) },
      {
        onSuccess: response => {
          baselineConfigRef.current = JSON.stringify(buildDashboardConfig(mergeDashboardCards(response.user?.dashboard_config ?? null)));
        },
      }
    );
  };

  const renderCard = (id: DashboardCardId) => {
    switch (id) {
      case 'jellyfin':
        return (
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
        );
      case 'upcoming':
        return (
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
        );
      case 'qbittorrent':
        return <QbittorrentLiveCard />;
      case 'scrutiny':
        return <ScrutinyHealthCard />;
      case 'netdata':
        return <NetdataOverviewCard />;
      case 'chores':
        return (
          <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-700/50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 text-sm">
                  ✅
                </div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{t('dashboard.pendingChores')}</h3>
              </div>
              {pendingChores.length > 5 && (
                <a href="/chores" className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
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
        );
      case 'activity':
        return (
          <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-neutral-200/60 dark:border-neutral-700/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/80 dark:bg-blue-900/30 text-sm">
                ⏰
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{t('dashboard.recentActivity')}</h3>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {activitiesLoading ? (
                  <>
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                  </>
                ) : activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-neutral-100/60 dark:hover:bg-neutral-700/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/60 text-sm">
                        {activity.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-800 dark:text-neutral-200">{activity.description}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <span className="text-3xl text-neutral-300 dark:text-neutral-600 mb-3 block">⏰</span>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('dashboard.noRecentActivity')}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{t('dashboard.startUsing')}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header: Greeting + Weather */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SmartGreeting
              userName={getUserFirstName(user, t('dashboard.user'))}
              pendingChores={stats?.chores_count || 0}
              shoppingItems={stats?.shopping_count || 0}
              eventsToday={stats?.events_today || 0}
            />
            <WeatherWidget />
          </div>
          <div className="shrink-0 pt-2">
            <div className="flex items-center gap-2">
              {isEditingLayout ? (
                <button
                  type="button"
                  onClick={resetLayout}
                  className="hidden sm:inline-flex items-center rounded-full border border-neutral-200/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/40 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-900"
                >
                  {t('dashboard.layout.reset', 'Reset')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (isEditingLayout && isDirty) saveNow();
                  setIsEditingLayout(prev => !prev);
                }}
                className="inline-flex items-center rounded-full border border-neutral-200/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/40 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-900"
              >
                {isEditingLayout ? t('dashboard.layout.done', 'Done') : t('dashboard.layout.edit', 'Edit')}
              </button>
            </div>
            {isEditingLayout ? (
              <p className="mt-2 hidden sm:block text-[11px] text-neutral-500 dark:text-neutral-400 max-w-[18rem]">
                {t('dashboard.layout.hint', 'Drag cards to reorder. Drag ↔ to resize.')}
              </p>
            ) : null}
            {updateProfileMutation.isPending ? (
              <p className="mt-2 hidden sm:block text-[11px] text-neutral-500 dark:text-neutral-400">Saving…</p>
            ) : null}
          </div>
        </div>

        {/* Quick Stats */}
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
          {dashboardCards.map(card => (
            <DashboardCardFrame
              key={card.id}
              card={card}
              isEditing={isEditingLayout}
              draggingId={draggingId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverCard={onDragOverCard}
              onToggleSize={toggleCardSize}
              onResizeSize={resizeCard}
            >
              {renderCard(card.id as DashboardCardId)}
            </DashboardCardFrame>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
