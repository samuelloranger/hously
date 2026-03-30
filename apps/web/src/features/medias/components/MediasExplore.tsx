import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExploreMedias, useRefreshRecommendations, type TmdbMediaSearchItem } from '@hously/shared';
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { ExploreCard } from './ExploreCard';
import { TmdbMediaSearchPanel } from './TmdbMediaSearchPanel';
import { DiscoverPanel } from './DiscoverPanel';

export function MediasExplore() {
  const { t, i18n } = useTranslation('common');
  const { data, isLoading, refetch } = useExploreMedias(i18n.language);
  const refreshRecommendations = useRefreshRecommendations(i18n.language);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-neutral-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10">
      <TmdbMediaSearchPanel onAdded={refetch} />

      <DiscoverPanel onAdded={refetch} />

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-10 space-y-10">
        {data && (
          <>
            <ExploreSection
              title={t('medias.explore.recommended')}
              items={data.recommended}
              onAdded={refetch}
              onRefresh={() => refreshRecommendations.mutate()}
              isRefreshing={refreshRecommendations.isPending}
            />
            <ExploreSection title={t('medias.explore.trending')} items={data.trending} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.nowPlaying')} items={data.now_playing} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.airingToday')} items={data.airing_today} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.popularMovies')} items={data.popular_movies} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.popularShows')} items={data.popular_shows} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.onTheAir')} items={data.on_the_air} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.upcomingMovies')} items={data.upcoming_movies} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.topRatedMovies')} items={data.top_rated_movies} onAdded={refetch} />
            <ExploreSection title={t('medias.explore.topRatedShows')} items={data.top_rated_shows} onAdded={refetch} />
          </>
        )}
      </div>
    </div>
  );
}

function ExploreSection({
  title,
  items,
  onAdded,
  onRefresh,
  isRefreshing,
}: {
  title: string;
  items: TmdbMediaSearchItem[];
  onAdded: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { t } = useTranslation('common');
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const handleRefresh = () => {
    onRefresh?.();
    setCollapsed(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <span>{title}</span>
          <span className="text-xs font-medium text-neutral-400">({items.length})</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                aria-label={t('common.refetch')}
                title={t('common.refetch')}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              type="button"
              onClick={() => scroll('left')}
              className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pt-1 pb-4 scrollbar-hide snap-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map(item => (
              <div key={item.id} className="flex-none w-40 sm:w-48 snap-start">
                <ExploreCard item={item} onAdded={onAdded} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
