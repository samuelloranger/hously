import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  useDiscoverMedias,
  useMediaGenres,
  useStreamingProviders,
} from "@/features/medias/hooks/useMedias";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExploreCard } from "@/pages/medias/_component/ExploreCard";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

// ─── Sort options ─────────────────────────────────────────────────────────────
type SortOpt = {
  value: string;
  labelKey: string;
  movieOnly?: true;
  tvOnly?: true;
};
const SORTS: SortOpt[] = [
  { value: "popularity.desc", labelKey: "medias.discover.sortPopularity" },
  { value: "vote_average.desc", labelKey: "medias.discover.sortTopRated" },
  {
    value: "primary_release_date.desc",
    labelKey: "medias.discover.sortNewest",
    movieOnly: true,
  },
  {
    value: "first_air_date.desc",
    labelKey: "medias.discover.sortNewest",
    tvOnly: true,
  },
  {
    value: "revenue.desc",
    labelKey: "medias.discover.sortRevenue",
    movieOnly: true,
  },
];

// ─── Genre colors ─────────────────────────────────────────────────────────────
const GENRE_COLORS: Record<string, { text: string; bg: string }> = {
  Action: { text: "#f87171", bg: "rgba(248,113,113,0.12)" },
  Adventure: { text: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  Animation: { text: "#34d399", bg: "rgba(52,211,153,0.12)" },
  Comedy: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  Crime: { text: "#9ca3af", bg: "rgba(156,163,175,0.09)" },
  Documentary: { text: "#2dd4bf", bg: "rgba(45,212,191,0.12)" },
  Drama: { text: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  Family: { text: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  Fantasy: { text: "#c084fc", bg: "rgba(192,132,252,0.12)" },
  Horror: { text: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  Music: { text: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  Mystery: { text: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  Romance: { text: "#fb7185", bg: "rgba(251,113,133,0.12)" },
  "Science Fiction": { text: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  Thriller: { text: "#f87171", bg: "rgba(248,113,113,0.12)" },
  War: { text: "#6b7280", bg: "rgba(107,114,128,0.09)" },
  Western: { text: "#d97706", bg: "rgba(217,119,6,0.12)" },
  History: { text: "#92400e", bg: "rgba(146,64,14,0.12)" },
  Kids: { text: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  "Sci-Fi & Fantasy": { text: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  "Action & Adventure": { text: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  "War & Politics": { text: "#6b7280", bg: "rgba(107,114,128,0.09)" },
  Soap: { text: "#fb7185", bg: "rgba(251,113,133,0.12)" },
  Talk: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  Reality: { text: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  News: { text: "#2dd4bf", bg: "rgba(45,212,191,0.12)" },
};

// ─── Language filter options ──────────────────────────────────────────────────
const LANGUAGE_FILTERS = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "fr", flag: "🇫🇷", label: "FR" },
];

// ─── Motion variants ──────────────────────────────────────────────────────────

const gridContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
};

// ─── DiscoverPanel ────────────────────────────────────────────────────────────
export function DiscoverPanel({ onAdded }: { onAdded: () => void }) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language;

  interface DiscoverFilters {
    mediaType: "movie" | "tv";
    providerId: number | null;
    genreId: number | null;
    sortBy: string;
    page: number;
    originalLanguage: string | null;
  }

  const [filters, setFilters] = useState<DiscoverFilters>({
    mediaType: "movie",
    providerId: null,
    genreId: null,
    sortBy: "popularity.desc",
    page: 1,
    originalLanguage: null,
  });

  const { mediaType, providerId, genreId, sortBy, page, originalLanguage } =
    filters;

  const topRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const { data: providersData } = useStreamingProviders("CA", mediaType, lang);
  const { data: genresData } = useMediaGenres(mediaType, lang);

  const { data, isLoading, isFetching } = useDiscoverMedias({
    type: mediaType,
    provider_id: providerId,
    genre_id: genreId,
    sort_by: sortBy,
    page,
    language: lang,
    region: "CA",
    original_language: originalLanguage,
  });

  const visibleSorts = SORTS.filter((s) => {
    if (mediaType === "tv" && s.movieOnly) return false;
    if (mediaType === "movie" && s.tvOnly) return false;
    return true;
  });

  function switchType(type: "movie" | "tv") {
    setFilters((prev) => {
      let nextSort = prev.sortBy;
      if (
        type === "tv" &&
        (nextSort === "revenue.desc" ||
          nextSort === "primary_release_date.desc")
      )
        nextSort = "popularity.desc";
      if (type === "movie" && nextSort === "first_air_date.desc")
        nextSort = "popularity.desc";
      return {
        ...prev,
        mediaType: type,
        genreId: null,
        sortBy: nextSort,
        page: 1,
      };
    });
  }

  function toggleProvider(id: number) {
    setFilters((prev) => ({
      ...prev,
      providerId: prev.providerId === id ? null : id,
      page: 1,
    }));
  }
  function toggleGenre(id: number) {
    setFilters((prev) => ({
      ...prev,
      genreId: prev.genreId === id ? null : id,
      page: 1,
    }));
  }
  function changeSort(value: string) {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  }
  function toggleLanguage(code: string) {
    setFilters((prev) => ({
      ...prev,
      originalLanguage: prev.originalLanguage === code ? null : code,
      page: 1,
    }));
  }

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results;
  const gridKey = `${mediaType}-${providerId}-${genreId}-${sortBy}-${originalLanguage}-${page}`;

  return (
    <section className="relative space-y-5">
      <div ref={topRef} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-baseline gap-2.5 px-0.5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t("medias.discover.title")}
        </h2>
        {totalResults != null && !isLoading && (
          <span className="text-xs tabular-nums text-neutral-400">
            {totalResults.toLocaleString()} {t("medias.discover.titles")}
          </span>
        )}
      </div>

      {/* ── Media-type toggle ───────────────────────────────── */}
      <SegmentedTabs
        items={[
          { id: "movie", label: t("medias.movie_plural") },
          { id: "tv", label: t("medias.series_plural") },
        ]}
        value={mediaType}
        onChange={switchType}
        containerClassName="flex w-full rounded-xl border border-neutral-200 bg-neutral-100 p-0.5 md:w-fit dark:border-neutral-800 dark:bg-neutral-900"
        itemClassName="relative z-10 flex-1 px-4 py-2 text-sm transition-[background-color,color,box-shadow] duration-200 md:flex-none md:py-1.5"
        activeItemClassName="dark:bg-white/10 dark:text-white"
        inactiveItemClassName="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      />

      {/* ── Streaming providers ─────────────────────────────── */}
      <div
        className="flex gap-2.5 overflow-x-auto"
        style={{
          scrollbarWidth: "none",
          margin: "0 -16px",
          padding: "4px 16px 8px",
        }}
      >
        {(providersData?.providers ?? []).slice(0, 10).map((provider) => {
          const active = providerId === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => toggleProvider(provider.id)}
              title={provider.name}
              aria-label={provider.name}
              className={[
                "flex shrink-0 items-center justify-center rounded-xl border transition-[border-color,background-color,transform] duration-200 select-none",
                "h-12 w-12 p-0 md:h-11 md:w-11",
                active
                  ? "scale-[1.08] border-white/40 bg-white/10"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:scale-[1.04]",
              ].join(" ")}
            >
              <img
                src={provider.logo_url}
                alt={provider.name}
                className="h-9 w-9 rounded-lg object-contain md:h-8 md:w-8"
              />
            </button>
          );
        })}
      </div>

      {/* ── Genres ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 md:gap-1.5">
        {genresData?.genres.map((genre) => {
          const active = genreId === genre.id;
          const colors = GENRE_COLORS[genre.name] ?? {
            text: "#6366f1",
            bg: "rgba(99,102,241,0.10)",
          };
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
                "rounded-full border px-3 py-1 text-xs font-medium transition-[border-color,background-color,color] duration-150 md:px-2.5 md:py-0.5 md:text-[11px]",
                active
                  ? ""
                  : "border-white/[0.07] bg-white/[0.03] text-neutral-500 hover:border-white/[0.14] hover:text-neutral-300",
              ].join(" ")}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      {/* ── Sort + Language row ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort — full scrollable strip on mobile */}
        <div
          className="overflow-x-auto md:overflow-visible"
          style={{ scrollbarWidth: "none" }}
        >
          <SegmentedTabs
            items={visibleSorts.map((s) => ({
              id: s.value,
              label: t(s.labelKey),
            }))}
            value={sortBy}
            onChange={changeSort}
            containerClassName="w-max rounded-xl border border-neutral-200 bg-neutral-100 p-1 md:p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
            itemClassName="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs transition-[background-color,color] duration-150 md:px-2.5 md:py-1 md:text-[11px]"
            activeItemClassName="dark:bg-white/10 dark:text-white"
            inactiveItemClassName="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          />
        </div>

        {/* Language pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
            {t("medias.discover.lang")}
          </span>
          {LANGUAGE_FILTERS.map((lf) => {
            const active = originalLanguage === lf.code;
            return (
              <button
                key={lf.code}
                type="button"
                onClick={() => toggleLanguage(lf.code)}
                className={[
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-[border-color,background-color,color] duration-150 md:px-2 md:py-0.5 md:text-[11px]",
                  active
                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                    : "border-white/[0.07] bg-white/[0.03] text-neutral-500 hover:border-white/[0.14] hover:text-neutral-300",
                ].join(" ")}
              >
                <span>{lf.flag}</span>
                <span>{lf.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Results grid ────────────────────────────────────── */}
      <div className="relative min-h-48">
        {isFetching && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.06]"
                style={{ animationDelay: `${i * 20}ms` }}
              />
            ))}
          </div>
        )}

        {!isFetching && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <p className="text-sm text-neutral-500">
              {t("medias.discover.noResults")}
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!isFetching && (data?.items.length ?? 0) > 0 && (
            <motion.div
              key={gridKey}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              variants={gridContainerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {data!.items.map((item) => (
                <motion.div key={item.id} variants={gridItemVariants}>
                  <ExploreCard item={item} onAdded={onAdded} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <>
          {/* Mobile pagination — prev / page indicator / next */}
          <div className="flex items-center justify-between gap-3 md:hidden">
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={page === 1 || isFetching}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-neutral-300 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              <span className="font-medium">Prev</span>
            </button>

            <span className="shrink-0 text-sm tabular-nums text-neutral-500">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.min(totalPages, prev.page + 1),
                }))
              }
              disabled={page === totalPages || isFetching}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-neutral-300 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="font-medium">Next</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Desktop pagination — full page number picker */}
          <div className="hidden items-center justify-center gap-2 md:flex">
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={page === 1 || isFetching}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="flex items-center gap-1">
              {page > 3 && (
                <>
                  <PageDot
                    n={1}
                    current={page}
                    onClick={() => setFilters((prev) => ({ ...prev, page: 1 }))}
                  />
                  {page > 4 && (
                    <span className="px-0.5 text-xs text-neutral-600">…</span>
                  )}
                </>
              )}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                return start + i;
              }).map((n) => (
                <PageDot
                  key={n}
                  n={n}
                  current={page}
                  onClick={() => setFilters((prev) => ({ ...prev, page: n }))}
                />
              ))}
              {page < totalPages - 2 && (
                <>
                  {page < totalPages - 3 && (
                    <span className="px-0.5 text-xs text-neutral-600">…</span>
                  )}
                  <PageDot
                    n={totalPages}
                    current={page}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, page: totalPages }))
                    }
                  />
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.min(totalPages, prev.page + 1),
                }))
              }
              disabled={page === totalPages || isFetching}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PageDot({
  n,
  current,
  onClick,
}: {
  n: number;
  current: number;
  onClick: () => void;
}) {
  const active = n === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-[background-color,border-color,color] duration-150",
        active
          ? "bg-indigo-600/80 text-white"
          : "border border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-neutral-200",
      ].join(" ")}
    >
      {n}
    </button>
  );
}
