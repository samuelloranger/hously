import { useMemo, type UIEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardJellyfinLatestInfinite } from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';
import { ListItemSkeleton } from '@/components/Skeleton';
import { MovieCard } from './MovieCard';

const mediaTypeConfig: Record<string, { emoji: string; badgeClass: string }> = {
  episode: { emoji: '📺', badgeClass: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30' },
  movie: { emoji: '🎬', badgeClass: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  musicalbum: { emoji: '💿', badgeClass: 'bg-lime-500/15 text-lime-200 border-lime-400/30' },
  audio: { emoji: '🎧', badgeClass: 'bg-lime-500/15 text-lime-200 border-lime-400/30' },
};

const getTypeConfig = (itemType: string | null) => {
  if (!itemType) return { emoji: '🎞️', badgeClass: 'bg-white/10 text-white border-white/20' };
  return (
    mediaTypeConfig[itemType.toLowerCase()] || { emoji: '🎞️', badgeClass: 'bg-white/10 text-white border-white/20' }
  );
};

const formatItemType = (itemType: string | null) => {
  if (!itemType) return 'Media';
  return itemType.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export function JellyfinLatestShelf() {
  const { data, isLoading, isError, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useDashboardJellyfinLatestInfinite(10);

  const { t, i18n } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);

  const handleShelfScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || !fetchNextPage || isFetchingNextPage) return;
    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget;
    if (scrollWidth - scrollLeft - clientWidth < 480) {
      fetchNextPage();
    }
  };

  const isEnabled = data?.pages[0]?.enabled ?? false;
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (
      data?.pages
        .flatMap(p => p.items)
        .filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }) ?? []
    );
  }, [data?.pages]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-300/60 dark:border-neutral-700/80 bg-gradient-to-br from-[#b1cefe] via-[#618ad1] to-[#adc9f1] dark:from-[#0f172a] dark:via-[#112240] dark:to-[#1f2937] shadow-xl pb-4">
      <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-blue-200/45 dark:bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-20 h-72 w-72 rounded-full bg-indigo-300/35 dark:bg-rose-500/15 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4 mb-4 px-4 md:px-5 pt-4 md:pt-5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-blue-900/75 dark:text-cyan-200/80">
            {t('dashboard.jellyfin.kicker')}
          </p>
          <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.jellyfin.title')}
          </h3>
          <p className="text-[10px] text-blue-900/70 dark:text-blue-100/80 mt-1">{t('dashboard.jellyfin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!refetch || isFetching}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-900/20 dark:border-white/25 bg-black/10 dark:bg-white/10 text-slate-900 dark:text-cyan-50 hover:bg-black/20 dark:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
            title={t('dashboard.jellyfin.refresh')}
            aria-label={t('dashboard.jellyfin.refresh')}
          >
            <span className={isFetching ? 'animate-spin' : ''}>↻</span>
          </button>
          <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-slate-900/15 dark:border-white/20 bg-black/10 dark:bg-white/10 text-base">
            🍿
          </div>
        </div>
      </div>

      {isError ? (
        <div className="mx-6 md:mx-8 rounded-2xl border border-red-500/40 dark:border-red-300/30 bg-red-100/60 dark:bg-red-300/10 p-4 text-red-900 dark:text-red-100">
          <p className="font-medium">{t('dashboard.jellyfin.errorTitle', 'Connection failed')}</p>
          <p className="text-xs text-red-900/80 dark:text-red-100/90 mt-1">
            {t('dashboard.jellyfin.errorDescription', 'Unable to reach Jellyfin. Tap refresh to retry.')}
          </p>
        </div>
      ) : isLoading ? (
        <div className="mx-6 md:mx-8 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white/35 dark:bg-black/20 p-4 space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      ) : !isEnabled ? (
        <div className="mx-6 md:mx-8 rounded-2xl border border-amber-500/40 dark:border-amber-300/30 bg-amber-100/60 dark:bg-amber-300/10 p-4 text-amber-900 dark:text-amber-100">
          <p className="font-medium">{t('dashboard.jellyfin.notConnectedTitle')}</p>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/90 mt-1">
            {t('dashboard.jellyfin.notConnectedDescription')}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-6 md:mx-8 rounded-2xl border border-slate-900/20 dark:border-white/20 bg-white/35 dark:bg-black/20 p-6 text-center">
          <p className="text-slate-900 dark:text-white font-medium">{t('dashboard.jellyfin.emptyTitle')}</p>
          <p className="text-xs text-blue-900/70 dark:text-blue-100/80 mt-1">
            {t('dashboard.jellyfin.emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="no-scrollbar overflow-x-auto overflow-y-visible px-6 pt-2 pb-2" onScroll={handleShelfScroll}>
          <div className="flex gap-3">
            {items.map((item, index) => {
              const typeConfig = getTypeConfig(item.item_type);
              const relativeTime = formatRelativeTime(item.added_at, { locale });
              const typeLabel = formatItemType(item.item_type);
              const releaseDateLabel = item.year ? String(item.year) : '';

              return (
                <MovieCard
                  key={`${item.id}-${index}`}
                  title={item.title}
                  subtitle={relativeTime}
                  type={typeLabel}
                  releaseDate={releaseDateLabel}
                  posterUrl={item.poster_url}
                  fallbackEmoji={typeConfig.emoji}
                  accentRingClassName="focus:ring-cyan-300/70"
                  animationDelayMs={index * 60}
                  href={item.item_url || ''}
                />
              );
            })}
            {isFetching ? (
              <div className="w-[130px] md:w-[150px] shrink-0 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white/30 dark:bg-black/25 p-2.5 backdrop-blur-sm">
                <div className="aspect-[2/3] rounded-xl bg-slate-900/15 dark:bg-neutral-900/60 flex items-center justify-center text-blue-900/80 dark:text-blue-100/85 text-[11px]">
                  {t('common.loading')}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
