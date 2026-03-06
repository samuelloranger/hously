import { format } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type DashboardUpcomingItem, type TmdbMediaSearchItem, useDashboardUpcoming } from '@hously/shared';
import { MovieCard } from './MovieCard';
import { ExploreCardDetailDialog } from '../../medias/components/ExploreCardDetailDialog';
import { ListItemSkeleton } from '../../../components/Skeleton';

import { enUS, fr } from 'date-fns/locale';
const localeMap = { en: enUS, fr } as const;

const formatReleaseDate = (value: string | null, locale: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const isSameYear = parsed.getFullYear() === new Date().getFullYear();

  const lang = (locale.split('-')[0] || 'en') as keyof typeof localeMap;
  if (isSameYear) {
    return format(parsed, locale.includes('en') ? 'MMM d yyyy' : 'd MMM yyyy', { locale: localeMap[lang] ?? enUS });
  }
  return format(parsed, locale.includes('en') ? 'MMM d, yyyy' : 'd MMM, yyyy', { locale: localeMap[lang] ?? enUS });
};

const mediaTypeLabel = (mediaType: 'movie' | 'tv', t: (key: string) => string) =>
  mediaType === 'movie' ? t('dashboard.upcoming.movie') : t('dashboard.upcoming.tv');

function toTmdbSearchItem(item: DashboardUpcomingItem): TmdbMediaSearchItem {
  const tmdbId = parseInt(item.id.split('-')[1] || '', 10);
  const releaseYear = item.release_date ? new Date(item.release_date).getFullYear() : null;

  return {
    id: item.id,
    tmdb_id: tmdbId,
    media_type: item.media_type,
    title: item.title,
    release_year: releaseYear && !Number.isNaN(releaseYear) ? releaseYear : null,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: null,
    service: item.media_type === 'movie' ? 'radarr' : 'sonarr',
    already_exists: false,
    can_add: true,
    source_id: null,
    arr_url: null,
  };
}

export function UpcomingShelf() {
  const { data, isLoading, isFetching, refetch } = useDashboardUpcoming();

  const { t, i18n } = useTranslation('common');
  const [selectedItem, setSelectedItem] = useState<TmdbMediaSearchItem | null>(null);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-amber-300/70 dark:border-orange-500/30 bg-gradient-to-br from-[#fad0ab] via-[#ffbf7e] to-[#ffe7d1] dark:from-[#2a1c10] dark:via-[#533516] dark:to-[#8b4b1b] shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-200/45 dark:bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-16 h-64 w-64 rounded-full bg-orange-300/40 dark:bg-orange-500/25 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4 mb-4 px-4 md:px-5 pt-4 md:pt-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-amber-950/70 dark:text-amber-200/80">
              {t('dashboard.upcoming.kicker')}
            </p>
            <h3 className="text-base md:text-lg font-bold text-amber-950 dark:text-amber-50">
              {t('dashboard.upcoming.title')}
            </h3>
            <p className="text-[10px] text-amber-900/70 dark:text-amber-100/80 mt-1">{t('dashboard.upcoming.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={!data?.enabled || isFetching}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-950/20 dark:border-white/25 bg-black/10 dark:bg-white/10 text-amber-950 dark:text-amber-50 hover:bg-black/20 dark:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
              title={t('dashboard.upcoming.refresh')}
              aria-label={t('dashboard.upcoming.refresh')}
            >
              <span className={isFetching ? 'animate-spin' : ''}>↻</span>
            </button>
            <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-amber-950/15 dark:border-white/20 bg-black/10 dark:bg-white/10 text-base">
              🍿
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-950/15 dark:border-white/15 bg-white/35 dark:bg-black/20 p-4 space-y-3">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : !data?.enabled ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-500/40 dark:border-amber-300/30 bg-amber-100/60 dark:bg-black/20 p-4 text-amber-950 dark:text-amber-50">
            <p className="font-medium">{t('dashboard.upcoming.notConfiguredTitle')}</p>
            <p className="text-xs text-amber-950/80 dark:text-amber-100/90 mt-1">
              {t('dashboard.upcoming.notConfiguredDescription')}
            </p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-950/20 dark:border-white/20 bg-white/35 dark:bg-black/20 p-6 text-center">
            <p className="text-amber-950 dark:text-white font-medium">{t('dashboard.upcoming.emptyTitle')}</p>
            <p className="text-xs text-amber-900/70 dark:text-amber-100/80 mt-1">
              {t('dashboard.upcoming.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto overflow-y-visible px-6 pt-2 pb-6">
            <div className="flex gap-3">
              {data.items.map(item => (
                <MovieCard
                  key={item.id}
                  title={item.title}
                  subtitle={
                    item.media_type === 'movie'
                      ? t('dashboard.upcoming.tapToAddMovie')
                      : t('dashboard.upcoming.tapToAddTv')
                  }
                  type={mediaTypeLabel(item.media_type, t)}
                  releaseDate={
                    formatReleaseDate(item.release_date, i18n.language) || t('dashboard.upcoming.unknownDate')
                  }
                  posterUrl={item.poster_url}
                  fallbackEmoji={item.media_type === 'movie' ? '🎬' : '📺'}
                  accentRingClassName="focus:ring-amber-200/70"
                  onClick={() => setSelectedItem(toTmdbSearchItem(item))}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedItem && (
        <ExploreCardDetailDialog
          item={selectedItem}
          isOpen
          onClose={() => setSelectedItem(null)}
          onAdded={() => {
            setSelectedItem(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
