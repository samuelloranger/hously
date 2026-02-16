import { format } from 'date-fns';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type DashboardUpcomingItem,
  useAddUpcomingToArr,
  useUpcomingStatus,
} from '@hously/shared';
import { Dialog } from '../../../components/dialog';
import { ListItemSkeleton } from '../../../components/Skeleton';

interface UpcomingShelfProps {
  enabled: boolean;
  radarrEnabled: boolean;
  sonarrEnabled: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  items: DashboardUpcomingItem[];
}

const formatReleaseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'MMM d, yyyy');
};

const mediaTypeLabel = (mediaType: 'movie' | 'tv', t: (key: string) => string) =>
  mediaType === 'movie' ? t('dashboard.upcoming.movie') : t('dashboard.upcoming.tv');

export function UpcomingShelf({
  enabled,
  radarrEnabled,
  sonarrEnabled,
  isLoading,
  isRefreshing = false,
  onRefresh,
  items,
}: UpcomingShelfProps) {
  const { t } = useTranslation('common');
  const [searchOnAdd, setSearchOnAdd] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DashboardUpcomingItem | null>(null);
  const [upcomingStatus, setUpcomingStatus] = useState<{ exists: boolean; service: 'radarr' | 'sonarr' } | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const onWheel = useCallback(
    (event: globalThis.WheelEvent) => {
      if (!emblaApi) return;
      const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = isHorizontal ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      if (delta > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    },
    [emblaApi],
  );

  useEffect(() => {
    const node = emblaApi?.rootNode();
    if (!node) return;
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [emblaApi, onWheel]);

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
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-orange-200/70 dark:border-orange-500/30 bg-gradient-to-br from-[#2a1c10] via-[#533516] to-[#8b4b1b] shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-16 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4 mb-6 px-6 md:px-8 pt-6 md:pt-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">{t('dashboard.upcoming.kicker')}</p>
            <h3 className="text-2xl md:text-3xl font-bold text-amber-50">{t('dashboard.upcoming.title')}</h3>
            <p className="text-sm text-amber-100/80 mt-1">{t('dashboard.upcoming.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={!onRefresh || isRefreshing}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-amber-50 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
              title={t('dashboard.upcoming.refresh')}
              aria-label={t('dashboard.upcoming.refresh')}
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
            </button>
            <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl">
              🍿
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-white/15 bg-black/20 p-4 space-y-3">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : !enabled ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-amber-300/30 bg-black/20 p-4 text-amber-50">
            <p className="font-medium">{t('dashboard.upcoming.notConfiguredTitle')}</p>
            <p className="text-sm text-amber-100/90 mt-1">{t('dashboard.upcoming.notConfiguredDescription')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="mx-6 md:mx-8 rounded-2xl border border-white/20 bg-black/20 p-6 text-center">
            <p className="text-white font-medium">{t('dashboard.upcoming.emptyTitle')}</p>
            <p className="text-sm text-amber-100/80 mt-1">{t('dashboard.upcoming.emptyDescription')}</p>
          </div>
        ) : (
          <div className="overflow-hidden px-6 pb-6" ref={emblaRef}>
            <div className="flex gap-3">
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const targetPluginEnabled = item.media_type === 'movie' ? radarrEnabled : sonarrEnabled;
                    if (!targetPluginEnabled) {
                      window.open(item.tmdb_url, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    setSelectedItem(item);
                  }}
                  disabled={addMutation.isPending}
                  className="group w-[130px] md:w-[150px] text-left shrink-0 rounded-2xl border border-white/15 bg-black/25 p-2.5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-amber-200/70 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900/60">
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-3xl text-amber-200/80">
                        {item.media_type === 'movie' ? '🎬' : '📺'}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 min-w-0">
                    <p className="text-xs text-white font-semibold truncate">{item.title}</p>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-amber-200/30 bg-amber-200/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-100">
                        {mediaTypeLabel(item.media_type, t)}
                      </span>
                      <span className="text-[10px] text-amber-100/85">
                        {formatReleaseDate(item.release_date) || t('dashboard.upcoming.unknownDate')}
                      </span>
                    </div>
                    {item.providers.length > 0 ? (
                      <div className="mt-1.5 flex items-center gap-1">
                        {item.providers.slice(0, 4).map(provider => (
                          <img
                            key={provider.id}
                            src={provider.logo_url}
                            alt={provider.name}
                            title={provider.name}
                            loading="lazy"
                            className="h-4 w-4 rounded-sm border border-white/30 bg-white/10 object-contain p-[1px]"
                          />
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1.5 text-[10px] text-amber-100/80">
                      {item.media_type === 'movie'
                        ? t('dashboard.upcoming.tapToAddMovie')
                        : t('dashboard.upcoming.tapToAddTv')}
                    </p>
                  </div>
                </button>
              ))}
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
