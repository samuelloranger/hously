import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscoverMedias, useMediaGenres, useStreamingProviders } from '@/hooks/useMedias';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExploreCard } from '@/pages/medias/_component/ExploreCard';

// ─── Sort options ─────────────────────────────────────────────────────────────
type SortOpt = { value: string; labelKey: string; movieOnly?: true; tvOnly?: true };
const SORTS: SortOpt[] = [
  { value: 'popularity.desc', labelKey: 'medias.discover.sortPopularity' },
  { value: 'vote_average.desc', labelKey: 'medias.discover.sortTopRated' },
  { value: 'primary_release_date.desc', labelKey: 'medias.discover.sortNewest', movieOnly: true },
  { value: 'first_air_date.desc', labelKey: 'medias.discover.sortNewest', tvOnly: true },
  { value: 'revenue.desc', labelKey: 'medias.discover.sortRevenue', movieOnly: true },
];

// ─── Genre colors ─────────────────────────────────────────────────────────────
const GENRE_COLORS: Record<string, { text: string; bg: string }> = {
  Action: { text: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  Adventure: { text: '#fb923c', bg: 'rgba(251,146,60,0.10)' },
  Animation: { text: '#34d399', bg: 'rgba(52,211,153,0.10)' },
  Comedy: { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  Crime: { text: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
  Documentary: { text: '#2dd4bf', bg: 'rgba(45,212,191,0.10)' },
  Drama: { text: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  Family: { text: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  Fantasy: { text: '#c084fc', bg: 'rgba(192,132,252,0.10)' },
  Horror: { text: '#f43f5e', bg: 'rgba(244,63,94,0.10)' },
  Music: { text: '#f472b6', bg: 'rgba(244,114,182,0.10)' },
  Mystery: { text: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
  Romance: { text: '#fb7185', bg: 'rgba(251,113,133,0.10)' },
  'Science Fiction': { text: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  Thriller: { text: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  War: { text: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  Western: { text: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  History: { text: '#92400e', bg: 'rgba(146,64,14,0.10)' },
  Kids: { text: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  'Sci-Fi & Fantasy': { text: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  'Action & Adventure': { text: '#fb923c', bg: 'rgba(251,146,60,0.10)' },
  'War & Politics': { text: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  Soap: { text: '#fb7185', bg: 'rgba(251,113,133,0.10)' },
  Talk: { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  Reality: { text: '#f472b6', bg: 'rgba(244,114,182,0.10)' },
  News: { text: '#2dd4bf', bg: 'rgba(45,212,191,0.10)' },
};

// ─── Language filter options ──────────────────────────────────────────────────
const LANGUAGE_FILTERS: { code: string; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
];

// ─── DiscoverPanel ────────────────────────────────────────────────────────────
export function DiscoverPanel({ onAdded }: { onAdded: () => void }) {
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language;

  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [providerId, setProviderId] = useState<number | null>(null);
  const [genreId, setGenreId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [page, setPage] = useState(1);
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

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
    original_language: originalLanguage,
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

  function toggleLanguage(code: string) {
    setOriginalLanguage(prev => (prev === code ? null : code));
    setPage(1);
  }

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results;
  const gridKey = `${mediaType}-${providerId}-${genreId}-${sortBy}-${originalLanguage}-${page}`;

  return (
    <section className="relative space-y-6">
      <div ref={topRef} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="relative flex items-baseline gap-2.5 px-0.5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{t('medias.discover.title')}</h2>
        {totalResults != null && !isLoading && (
          <span className="text-xs tabular-nums text-neutral-400">{totalResults.toLocaleString()} titles</span>
        )}
      </div>

      <p className="px-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {t('medias.discover.subtitle')}
      </p>

      {/* ── Media-type toggle ───────────────────────────────── */}
      <div className="relative flex w-fit rounded-xl border border-neutral-800 bg-neutral-900 p-0.5">
        {(['movie', 'tv'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => switchType(type)}
            className={[
              'relative z-10 rounded-lg px-4 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200',
              mediaType === type ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300',
            ].join(' ')}
          >
            {type === 'movie' ? t('medias.movie_plural') : t('medias.series_plural')}
          </button>
        ))}
      </div>

      {/* ── Streaming providers ─────────────────────────────── */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', margin: '0 -12px', padding: '12px' }}
      >
        {(providersData?.providers ?? []).slice(0, 10).map(provider => {
          const active = providerId === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => toggleProvider(provider.id)}
              title={provider.name}
              aria-label={provider.name}
              className={[
                'flex shrink-0 items-center justify-center rounded-xl border transition-[border-color,background-color,transform] duration-200 select-none',
                'h-11 w-11 p-0',
                active
                  ? 'scale-[1.08] border-white/40 bg-white/10'
                  : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:scale-[1.04]',
              ].join(' ')}
            >
              <img src={provider.logo_url} alt={provider.name} className="h-8 w-8 rounded-lg object-contain" />
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
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-[border-color,background-color,color] duration-150',
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
        <div className="flex shrink-0 gap-0.5 rounded-xl border border-neutral-800 bg-neutral-900 p-0.5">
          {visibleSorts.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => changeSort(s.value)}
              className={[
                'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-[background-color,color] duration-150',
                sortBy === s.value ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300',
              ].join(' ')}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Language filters ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-widest text-neutral-600">Lang</span>
        {LANGUAGE_FILTERS.map(lf => {
          const active = originalLanguage === lf.code;
          return (
            <button
              key={lf.code}
              type="button"
              onClick={() => toggleLanguage(lf.code)}
              className={[
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-[border-color,background-color,color] duration-150',
                active
                  ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/[0.07] bg-white/[0.03] text-neutral-500 hover:border-white/[0.14] hover:text-neutral-300',
              ].join(' ')}
            >
              <span>{lf.flag}</span>
              <span>{lf.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Results grid ────────────────────────────────────── */}
      <div className="relative min-h-48">
        {/* Skeleton — shown on initial load AND page navigation */}
        {isFetching && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.06]"
                style={{ animationDelay: `${i * 20}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isFetching && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <p className="text-sm text-neutral-500">{t('medias.discover.noResults')}</p>
          </div>
        )}

        {/* Cards */}
        {!isFetching && (data?.items.length ?? 0) > 0 && (
          <div
            key={gridKey}
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6"
          >
            {data!.items.map(item => (
              <ExploreCard key={item.id} item={item} onAdded={onAdded} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPage(p => Math.max(1, p - 1));
            }}
            disabled={page === 1 || isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex items-center gap-1">
            {/* First page shortcut */}
            {page > 3 && (
              <>
                <PageDot
                  n={1}
                  current={page}
                  onClick={() => {
                    setPage(1);
                  }}
                />
                {page > 4 && <span className="px-0.5 text-xs text-neutral-600">…</span>}
              </>
            )}
            {/* Window of pages around current */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            }).map(n => (
              <PageDot
                key={n}
                n={n}
                current={page}
                onClick={() => {
                  setPage(n);
                }}
              />
            ))}
            {/* Last page shortcut */}
            {page < totalPages - 2 && (
              <>
                {page < totalPages - 3 && <span className="px-0.5 text-xs text-neutral-600">…</span>}
                <PageDot
                  n={totalPages}
                  current={page}
                  onClick={() => {
                    setPage(totalPages);
                  }}
                />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setPage(p => Math.min(totalPages, p + 1));
            }}
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
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-[background-color,border-color,color] duration-150',
        active
          ? 'bg-indigo-600/80 text-white'
          : 'border border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-neutral-200',
      ].join(' ')}
    >
      {n}
    </button>
  );
}
