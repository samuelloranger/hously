import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscoverMedias, useMediaGenres, useStreamingProviders } from '@hously/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExploreCard } from './ExploreCard';

// ─── Featured provider IDs (in display order) ────────────────────────────────
// We keep the brand colors for the glow/ambient effect; logos come from TMDB.
const FEATURED_PROVIDERS: { id: number; color: string }[] = [
  { id: 8,    color: '#E50914' }, // Netflix
  { id: 9,    color: '#00A8E1' }, // Prime
  { id: 337,  color: '#4B7FFF' }, // Disney+
  { id: 230,  color: '#00C1F3' }, // Crave
  { id: 350,  color: '#c0c0c0' }, // Apple TV+
  { id: 531,  color: '#2B6EFF' }, // Paramount+
  { id: 1899, color: '#8B9EFF' }, // Max
  { id: 73,   color: '#FF5C5C' }, // Tubi
];

// ─── Sort options ─────────────────────────────────────────────────────────────
type SortOpt = { value: string; labelKey: string; movieOnly?: true; tvOnly?: true };
const SORTS: SortOpt[] = [
  { value: 'popularity.desc',           labelKey: 'medias.discover.sortPopularity' },
  { value: 'vote_average.desc',         labelKey: 'medias.discover.sortTopRated' },
  { value: 'primary_release_date.desc', labelKey: 'medias.discover.sortNewest', movieOnly: true },
  { value: 'first_air_date.desc',       labelKey: 'medias.discover.sortNewest',  tvOnly: true },
  { value: 'revenue.desc',              labelKey: 'medias.discover.sortRevenue',  movieOnly: true },
];

// ─── Genre colors ─────────────────────────────────────────────────────────────
const GENRE_COLORS: Record<string, { text: string; bg: string }> = {
  Action:             { text: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  Adventure:          { text: '#fb923c', bg: 'rgba(251,146,60,0.10)'  },
  Animation:          { text: '#34d399', bg: 'rgba(52,211,153,0.10)'  },
  Comedy:             { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  },
  Crime:              { text: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
  Documentary:        { text: '#2dd4bf', bg: 'rgba(45,212,191,0.10)'  },
  Drama:              { text: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  Family:             { text: '#4ade80', bg: 'rgba(74,222,128,0.10)'  },
  Fantasy:            { text: '#c084fc', bg: 'rgba(192,132,252,0.10)' },
  Horror:             { text: '#f43f5e', bg: 'rgba(244,63,94,0.10)'   },
  Music:              { text: '#f472b6', bg: 'rgba(244,114,182,0.10)' },
  Mystery:            { text: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
  Romance:            { text: '#fb7185', bg: 'rgba(251,113,133,0.10)' },
  'Science Fiction':  { text: '#38bdf8', bg: 'rgba(56,189,248,0.10)'  },
  Thriller:           { text: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  War:                { text: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  Western:            { text: '#d97706', bg: 'rgba(217,119,6,0.10)'   },
  History:            { text: '#92400e', bg: 'rgba(146,64,14,0.10)'   },
  Kids:               { text: '#4ade80', bg: 'rgba(74,222,128,0.10)'  },
  'Sci-Fi & Fantasy': { text: '#38bdf8', bg: 'rgba(56,189,248,0.10)'  },
  'Action & Adventure':{ text: '#fb923c', bg: 'rgba(251,146,60,0.10)' },
  'War & Politics':   { text: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  Soap:               { text: '#fb7185', bg: 'rgba(251,113,133,0.10)' },
  Talk:               { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  },
  Reality:            { text: '#f472b6', bg: 'rgba(244,114,182,0.10)' },
  News:               { text: '#2dd4bf', bg: 'rgba(45,212,191,0.10)'  },
};

function hex2rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── DiscoverPanel ────────────────────────────────────────────────────────────
export function DiscoverPanel({ onAdded }: { onAdded: () => void }) {
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language;

  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [providerId, setProviderId] = useState<number | null>(null);
  const [genreId, setGenreId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [page, setPage] = useState(1);

  const activeProviderConfig = FEATURED_PROVIDERS.find(p => p.id === providerId) ?? null;

  const { data: providersData } = useStreamingProviders('CA', mediaType);
  const { data: genresData } = useMediaGenres(mediaType);

  const { data, isLoading, isFetching } = useDiscoverMedias({
    type: mediaType,
    provider_id: providerId,
    genre_id: genreId,
    sort_by: sortBy,
    page,
    language: lang,
    region: 'CA',
  });

  const visibleSorts = SORTS.filter(s => {
    if (mediaType === 'tv' && s.movieOnly) return false;
    if (mediaType === 'movie' && s.tvOnly) return false;
    return true;
  });

  function switchType(type: 'movie' | 'tv') {
    setMediaType(type);
    setGenreId(null);
    setPage(1);
    if (type === 'tv' && (sortBy === 'revenue.desc' || sortBy === 'primary_release_date.desc')) {
      setSortBy('popularity.desc');
    }
    if (type === 'movie' && sortBy === 'first_air_date.desc') {
      setSortBy('popularity.desc');
    }
  }

  function toggleProvider(id: number) {
    setProviderId(prev => (prev === id ? null : id));
    setPage(1);
  }

  function toggleGenre(id: number) {
    setGenreId(prev => (prev === id ? null : id));
    setPage(1);
  }

  function changeSort(value: string) {
    setSortBy(value);
    setPage(1);
  }

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results;
  const gridKey = `${mediaType}-${providerId}-${genreId}-${sortBy}-${page}`;

  return (
    <section className="relative space-y-6">
      {/* Ambient provider glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-72 w-[60%] rounded-full blur-3xl transition-all duration-700"
        style={{
          backgroundColor: activeProviderConfig
            ? hex2rgba(activeProviderConfig.color, 0.08)
            : 'transparent',
        }}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="relative flex items-baseline gap-2.5 px-0.5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t('medias.discover.title')}
        </h2>
        {totalResults != null && !isLoading && (
          <span className="text-xs tabular-nums text-neutral-400">
            {totalResults.toLocaleString()} titles
          </span>
        )}
      </div>

      {/* ── Media-type toggle ───────────────────────────────── */}
      <div className="relative flex w-fit rounded-xl border border-white/[0.07] bg-neutral-900/60 p-0.5 backdrop-blur-sm dark:border-white/[0.06]">
        {(['movie', 'tv'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => switchType(type)}
            className={[
              'relative z-10 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200',
              mediaType === type
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300',
            ].join(' ')}
          >
            {type === 'movie' ? t('medias.movie_plural') : t('medias.series_plural')}
          </button>
        ))}
      </div>

      {/* ── Streaming providers ─────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto overflow-visible pb-1" style={{ scrollbarWidth: 'none' }}>
        {FEATURED_PROVIDERS.map(cfg => {
          const provider = providersData?.providers.find(p => p.id === cfg.id);
          const active = providerId === cfg.id;
          return (
            <button
              key={cfg.id}
              type="button"
              onClick={() => toggleProvider(cfg.id)}
              title={provider?.name ?? String(cfg.id)}
              aria-label={provider?.name ?? String(cfg.id)}
              style={
                active
                  ? ({
                      backgroundColor: hex2rgba(cfg.color, 0.18),
                      borderColor: cfg.color,
                      boxShadow: `0 0 16px ${hex2rgba(cfg.color, 0.30)}, inset 0 0 12px ${hex2rgba(cfg.color, 0.08)}`,
                    } as CSSProperties)
                  : undefined
              }
              className={[
                'flex shrink-0 items-center justify-center rounded-xl border transition-all duration-200 select-none',
                'h-11 w-11 p-0',
                active
                  ? 'scale-[1.08]'
                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.18] hover:scale-[1.04]',
              ].join(' ')}
            >
              {provider?.logo_url ? (
                <img
                  src={provider.logo_url}
                  alt={provider.name}
                  className="h-8 w-8 rounded-lg object-contain"
                />
              ) : (
                <span
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: hex2rgba(cfg.color, 0.5) }}
                >
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Genres + Sort row ───────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {/* Genre pills */}
        <div className="flex flex-1 flex-wrap gap-1.5">
          {genresData?.genres.map(genre => {
            const active = genreId === genre.id;
            const colors = GENRE_COLORS[genre.name] ?? { text: '#6366f1', bg: 'rgba(99,102,241,0.10)' };
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                style={
                  active
                    ? {
                        color: colors.text,
                        backgroundColor: colors.bg,
                        borderColor: `${colors.text}50`,
                      }
                    : undefined
                }
                className={[
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all duration-150',
                  active
                    ? ''
                    : 'border-white/[0.07] bg-white/[0.03] text-neutral-500 hover:border-white/[0.14] hover:text-neutral-300',
                ].join(' ')}
              >
                {genre.name}
              </button>
            );
          })}
        </div>

        {/* Sort segmented control */}
        <div className="flex shrink-0 gap-0.5 rounded-xl border border-white/[0.07] bg-neutral-900/60 p-0.5 backdrop-blur-sm">
          {visibleSorts.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => changeSort(s.value)}
              className={[
                'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                sortBy === s.value
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-neutral-300',
              ].join(' ')}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results grid ────────────────────────────────────── */}
      <div className="relative min-h-48">
        {/* Fetching overlay */}
        {isFetching && !isLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-6">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur-sm">
              <div className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
              Loading
            </div>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-7 2xl:grid-cols-7">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.05]"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <p className="text-sm text-neutral-500">{t('medias.discover.noResults')}</p>
          </div>
        )}

        {/* Cards */}
        {!isLoading && (data?.items.length ?? 0) > 0 && (
          <div
            key={gridKey}
            className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-7 2xl:grid-cols-7"
          >
            {data!.items.map((item, index) => (
              <div
                key={item.id}
                className="animate-[discover-in_0.38s_ease-out_both]"
                style={{ animationDelay: `${Math.min(index * 35, 420)}ms` }}
              >
                <ExploreCard item={item} onAdded={onAdded} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex items-center gap-1">
            {/* First page shortcut */}
            {page > 3 && (
              <>
                <PageDot n={1} current={page} onClick={() => setPage(1)} />
                {page > 4 && <span className="px-0.5 text-xs text-neutral-600">…</span>}
              </>
            )}
            {/* Window of pages around current */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            }).map(n => (
              <PageDot key={n} n={n} current={page} onClick={() => setPage(n)} />
            ))}
            {/* Last page shortcut */}
            {page < totalPages - 2 && (
              <>
                {page < totalPages - 3 && <span className="px-0.5 text-xs text-neutral-600">…</span>}
                <PageDot n={totalPages} current={page} onClick={() => setPage(totalPages)} />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}

function PageDot({ n, current, onClick }: { n: number; current: number; onClick: () => void }) {
  const active = n === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-all duration-150',
        active
          ? 'bg-indigo-600/80 text-white'
          : 'border border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-neutral-200',
      ].join(' ')}
    >
      {n}
    </button>
  );
}
