import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { DashboardUpcomingItem } from '../../../types';
import { ListItemSkeleton } from '../../../components/Skeleton';

interface UpcomingShelfProps {
  enabled: boolean;
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

export function UpcomingShelf({ enabled, isLoading, isRefreshing = false, onRefresh, items }: UpcomingShelfProps) {
  const { t } = useTranslation('common');

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-orange-200/70 dark:border-orange-500/30 bg-gradient-to-br from-[#2a1c10] via-[#533516] to-[#8b4b1b] p-6 md:p-8 shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-14 -bottom-16 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4 mb-6">
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
        <div className="rounded-2xl border border-white/15 bg-black/20 p-4 space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      ) : !enabled ? (
        <div className="rounded-2xl border border-amber-300/30 bg-black/20 p-4 text-amber-50">
          <p className="font-medium">{t('dashboard.upcoming.notConfiguredTitle')}</p>
          <p className="text-sm text-amber-100/90 mt-1">{t('dashboard.upcoming.notConfiguredDescription')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/20 bg-black/20 p-6 text-center">
          <p className="text-white font-medium">{t('dashboard.upcoming.emptyTitle')}</p>
          <p className="text-sm text-amber-100/80 mt-1">{t('dashboard.upcoming.emptyDescription')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-3 -mb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-3 snap-x snap-mandatory min-w-max pr-2">
          {items.map(item => (
            <a
              key={item.id}
              href={item.tmdb_url}
              target="_blank"
              rel="noreferrer"
                className="group w-[170px] md:w-[190px] shrink-0 snap-start rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
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
              <div className="mt-3 min-w-0">
                <p className="text-white font-semibold truncate">{item.title}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-200/30 bg-amber-200/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-100">
                    {mediaTypeLabel(item.media_type, t)}
                  </span>
                  <span className="text-xs text-amber-100/85">
                    {formatReleaseDate(item.release_date) || t('dashboard.upcoming.unknownDate')}
                  </span>
                </div>
                {item.providers.length > 0 ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    {item.providers.slice(0, 4).map(provider => (
                      <img
                        key={provider.id}
                        src={provider.logo_url}
                        alt={provider.name}
                        title={provider.name}
                        loading="lazy"
                        className="h-5 w-5 rounded-sm border border-white/30 bg-white/10 object-contain p-[1px]"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </a>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}
