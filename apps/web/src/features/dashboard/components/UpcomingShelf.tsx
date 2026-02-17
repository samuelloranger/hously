import { format } from 'date-fns';
import { type UIEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type DashboardUpcomingItem, useAddUpcomingToArr, useUpcomingStatus } from '@hously/shared';
import { MovieCard } from './MovieCard';
import { Dialog } from '../../../components/dialog';
import { ListItemSkeleton } from '../../../components/Skeleton';

interface UpcomingShelfProps {
  enabled: boolean;
  radarrEnabled: boolean;
  sonarrEnabled: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  items: DashboardUpcomingItem[];
}

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

export function UpcomingShelf({
  enabled,
  radarrEnabled,
  sonarrEnabled,
  isLoading,
  isRefreshing = false,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
  items,
}: UpcomingShelfProps) {
  const { t, i18n } = useTranslation('common');
  const [searchOnAdd, setSearchOnAdd] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DashboardUpcomingItem | null>(null);
  const [upcomingStatus, setUpcomingStatus] = useState<{ exists: boolean; service: 'radarr' | 'sonarr' } | null>(null);

  const handleShelfScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || !onLoadMore || isLoadingMore) return;
    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget;
    if (scrollWidth - scrollLeft - clientWidth < 480) {
      onLoadMore();
    }
  };

  const addMutation = useAddUpcomingToArr();
  const upcomingStatusMutation = useUpcomingStatus();

  useEffect(() => {
    if (!selectedItem) {
      setUpcomingStatus(null);
      return;
    }

    let canceled = false;
    upcomingStatusMutation
      .mutateAsync({
        media_type: selectedItem.media_type,
        tmdb_id: parseInt(selectedItem.id.split('-')[1] || '', 10),
      })
      .then(status => {
        console.log('status', status);
        if (!canceled) setUpcomingStatus(status);
      })
      .catch(() => {
        if (!canceled) setUpcomingStatus(null);
      });

    return () => {
      canceled = true;
    };
  }, [selectedItem, upcomingStatusMutation]);

  const handleAdd = async (item: DashboardUpcomingItem) => {
    const tmdbId = parseInt(item.id.split('-')[1] || '', 10);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      toast.error(t('dashboard.upcoming.addFailed'));
      return;
    }

    try {
      const result = await addMutation.mutateAsync({
        media_type: item.media_type,
        tmdb_id: tmdbId,
        search_on_add: searchOnAdd,
      });

      if (result.already_exists) {
        toast.info(t('dashboard.upcoming.alreadyAddedDescription', { service: result.service }));
        return;
      }

      toast.success(t('dashboard.upcoming.addedDescription', { service: result.service }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dashboard.upcoming.addFailed');
      toast.error(message);
    }
  };

  const closeConfirmDialog = () => {
    if (addMutation.isPending) return;
    setSelectedItem(null);
  };

  const confirmAdd = async () => {
    if (!selectedItem) return;
    const targetPluginEnabled = selectedItem.media_type === 'movie' ? radarrEnabled : sonarrEnabled;
    if (!targetPluginEnabled) {
      window.open(selectedItem.tmdb_url, '_blank', 'noopener,noreferrer');
      setSelectedItem(null);
      return;
    }

    const itemToAdd = selectedItem;
    setSelectedItem(null);
    await handleAdd(itemToAdd);
  };

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-amber-300/70 dark:border-orange-500/30 bg-gradient-to-br from-[#fad0ab] via-[#ffbf7e] to-[#ffe7d1] dark:from-[#2a1c10] dark:via-[#533516] dark:to-[#8b4b1b] shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-200/45 dark:bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-16 h-64 w-64 rounded-full bg-orange-300/40 dark:bg-orange-500/25 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4 mb-6 px-6 md:px-8 pt-6 md:pt-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber-950/70 dark:text-amber-200/80">
              {t('dashboard.upcoming.kicker')}
            </p>
            <h3 className="text-2xl md:text-3xl font-bold text-amber-950 dark:text-amber-50">{t('dashboard.upcoming.title')}</h3>
            <p className="text-sm text-amber-900/70 dark:text-amber-100/80 mt-1">{t('dashboard.upcoming.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={!onRefresh || isRefreshing}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-950/20 dark:border-white/25 bg-black/10 dark:bg-white/10 text-amber-950 dark:text-amber-50 hover:bg-black/20 dark:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
              title={t('dashboard.upcoming.refresh')}
              aria-label={t('dashboard.upcoming.refresh')}
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
            </button>
            <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-amber-950/15 dark:border-white/20 bg-black/10 dark:bg-white/10 text-2xl">
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
        ) : !enabled ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-500/40 dark:border-amber-300/30 bg-amber-100/60 dark:bg-black/20 p-4 text-amber-950 dark:text-amber-50">
            <p className="font-medium">{t('dashboard.upcoming.notConfiguredTitle')}</p>
            <p className="text-sm text-amber-950/80 dark:text-amber-100/90 mt-1">{t('dashboard.upcoming.notConfiguredDescription')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-950/20 dark:border-white/20 bg-white/35 dark:bg-black/20 p-6 text-center">
            <p className="text-amber-950 dark:text-white font-medium">{t('dashboard.upcoming.emptyTitle')}</p>
            <p className="text-sm text-amber-900/70 dark:text-amber-100/80 mt-1">{t('dashboard.upcoming.emptyDescription')}</p>
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto overflow-y-visible px-6 pt-2 pb-6" onScroll={handleShelfScroll}>
            <div className="flex gap-3">
              {items.map(item => (
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
                  disabled={addMutation.isPending}
                  onClick={() => {
                    const targetPluginEnabled = item.media_type === 'movie' ? radarrEnabled : sonarrEnabled;
                    if (!targetPluginEnabled) {
                      window.open(item.tmdb_url, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    setSelectedItem(item);
                  }}
                />
              ))}
              {isLoadingMore ? (
                <div className="w-[130px] md:w-[150px] shrink-0 rounded-2xl border border-amber-950/15 dark:border-white/15 bg-white/30 dark:bg-black/25 p-2.5 backdrop-blur-sm">
                  <div className="aspect-[2/3] rounded-xl bg-amber-950/15 dark:bg-neutral-900/60 flex items-center justify-center text-amber-950/80 dark:text-amber-100/85 text-xs">
                    {t('common.loading')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <Dialog isOpen={selectedItem !== null} onClose={closeConfirmDialog} title={t('dashboard.upcoming.confirmTitle')}>
        {selectedItem ? (
          <div className="space-y-4">
            {upcomingStatus?.exists ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {upcomingStatus.service === 'radarr'
                  ? t('dashboard.upcoming.alreadyAddedRadarr')
                  : t('dashboard.upcoming.alreadyAddedSonarr')}
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-700 dark:text-neutral-200">
                  {t('dashboard.upcoming.confirmDescription', {
                    title: selectedItem.title,
                    service: selectedItem.media_type === 'movie' ? 'Radarr' : 'Sonarr',
                  })}
                </p>

                <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200 select-none">
                  <input type="checkbox" checked={searchOnAdd} onChange={e => setSearchOnAdd(e.target.checked)} />
                  {t('dashboard.upcoming.searchOnAdd')}
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={addMutation.isPending}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-60"
              >
                {t('common.cancel')}
              </button>
              {!(
                upcomingStatus?.exists &&
                upcomingStatus.service === (selectedItem?.media_type === 'movie' ? 'radarr' : 'sonarr')
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    void confirmAdd();
                  }}
                  disabled={addMutation.isPending}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {addMutation.isPending ? t('common.loading') : t('dashboard.upcoming.confirmButton')}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
