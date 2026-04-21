import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  useDiscoverMedias,
  useMediaGenres,
  useStreamingProviders,
} from "@/features/medias/hooks/useMedias";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Tv,
  Tag,
  ArrowDownUp,
} from "lucide-react";
import { ExploreCard } from "@/pages/medias/_component/ExploreCard";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

// ─── Language filter options ──────────────────────────────────────────────────
const LANGUAGE_FILTERS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
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
export function DiscoverPanel() {
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

  const providers = providersData?.providers ?? [];
  const genres = genresData?.genres ?? [];

  const activeProvider = providers.find((p) => p.id === providerId) ?? null;
  const activeGenre = genres.find((g) => g.id === genreId) ?? null;
  const activeSort = visibleSorts.find((s) => s.value === sortBy) ?? null;

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

  function setProvider(id: number | null) {
    setFilters((prev) => ({ ...prev, providerId: id, page: 1 }));
  }
  function setGenre(id: number | null) {
    setFilters((prev) => ({ ...prev, genreId: id, page: 1 }));
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
        containerClassName="max-w-sm"
      />

      {/* ── Filter toolbar: Service · Genre · Sort · Language ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Service */}
        <FilterChip
          icon={Tv}
          label={t("medias.discover.service", { defaultValue: "Service" })}
          value={
            activeProvider ? (
              <span className="flex items-center gap-1.5">
                <img
                  src={activeProvider.logo_url}
                  alt=""
                  className="h-4 w-4 rounded-sm object-contain"
                />
                <span className="truncate max-w-[8rem]">
                  {activeProvider.name}
                </span>
              </span>
            ) : null
          }
          onClear={activeProvider ? () => setProvider(null) : undefined}
          popoverContent={(close) => (
            <ServicePicker
              providers={providers.slice(0, 18)}
              selectedId={providerId}
              onSelect={(id) => {
                setProvider(id);
                close();
              }}
              allLabel={t("medias.discover.allServices", {
                defaultValue: "All services",
              })}
            />
          )}
        />

        {/* Genre */}
        <FilterChip
          icon={Tag}
          label={t("medias.discover.genre", { defaultValue: "Genre" })}
          value={activeGenre?.name ?? null}
          onClear={activeGenre ? () => setGenre(null) : undefined}
          popoverContent={(close) => (
            <GenrePicker
              genres={genres}
              selectedId={genreId}
              onSelect={(id) => {
                setGenre(id);
                close();
              }}
              allLabel={t("medias.discover.allGenres", {
                defaultValue: "All genres",
              })}
            />
          )}
        />

        {/* Sort */}
        <FilterChip
          icon={ArrowDownUp}
          label={t("medias.discover.sort", { defaultValue: "Sort" })}
          value={activeSort ? t(activeSort.labelKey) : null}
          popoverContent={(close) => (
            <SortPicker
              options={visibleSorts.map((s) => ({
                value: s.value,
                label: t(s.labelKey),
              }))}
              selected={sortBy}
              onSelect={(value) => {
                changeSort(value);
                close();
              }}
            />
          )}
        />

        {/* Spacer pushes language pills to the right on wider screens */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600 dark:text-neutral-500">
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
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary-500/60 bg-primary-500/15 text-primary-700 dark:text-primary-300"
                    : "border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-white/20",
                ].join(" ")}
              >
                {lf.label}
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
                  <ExploreCard item={item} />
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

// ─── FilterChip ───────────────────────────────────────────────────────────────
/**
 * A compact pill with an icon + label ("Sort"), optional inline value, chevron,
 * and a clear (X) button when a value is selected. Clicking opens a popover.
 */
function FilterChip({
  icon: Icon,
  label,
  value,
  onClear,
  popoverContent,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: React.ReactNode | null;
  onClear?: () => void;
  popoverContent: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== null && value !== undefined;
  return (
    <div
      className={[
        "inline-flex items-center rounded-full border text-xs font-medium transition-colors",
        active
          ? "border-primary-500/50 bg-primary-500/10 text-primary-700 dark:text-primary-200"
          : "border-neutral-200 dark:border-white/[0.09] bg-white dark:bg-white/[0.03] text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-white/20",
      ].join(" ")}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            <Icon
              className={active ? "text-primary-500" : "text-neutral-400"}
              size={13}
            />
            <span
              className={
                active ? "text-[11px] uppercase tracking-wide opacity-70" : ""
              }
            >
              {label}
            </span>
            {active && (
              <>
                <span className="opacity-40">·</span>
                <span className="font-semibold">{value}</span>
              </>
            )}
            <ChevronDown size={12} className="opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-80 p-0 overflow-hidden"
        >
          {popoverContent(() => setOpen(false))}
        </PopoverContent>
      </Popover>

      {active && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Clear filter"
          className="mr-1 flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── ServicePicker ────────────────────────────────────────────────────────────
function ServicePicker({
  providers,
  selectedId,
  onSelect,
  allLabel,
}: {
  providers: { id: number; name: string; logo_url: string }[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  allLabel: string;
}) {
  return (
    <div className="max-h-[360px] overflow-y-auto p-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
          selectedId === null
            ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-200"
            : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5",
        ].join(" ")}
      >
        <span className="font-medium">{allLabel}</span>
        {selectedId === null && <Check size={14} />}
      </button>
      <div className="mt-1 grid grid-cols-4 gap-1.5 p-1">
        {providers.map((p) => {
          const active = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              title={p.name}
              aria-label={p.name}
              className={[
                "relative flex aspect-square items-center justify-center rounded-lg border p-1.5 transition-all",
                active
                  ? "border-primary-500 ring-2 ring-primary-500/30 bg-primary-500/5"
                  : "border-neutral-200 dark:border-white/[0.08] hover:border-neutral-400 dark:hover:border-white/20",
              ].join(" ")}
            >
              <img
                src={p.logo_url}
                alt={p.name}
                className="h-full w-full rounded-md object-contain"
              />
              {active && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-white ring-2 ring-white dark:ring-neutral-800">
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GenrePicker ──────────────────────────────────────────────────────────────
function GenrePicker({
  genres,
  selectedId,
  onSelect,
  allLabel,
}: {
  genres: { id: number; name: string }[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  allLabel: string;
}) {
  return (
    <div className="max-h-[360px] overflow-y-auto p-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
          selectedId === null
            ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-200"
            : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5",
        ].join(" ")}
      >
        <span className="font-medium">{allLabel}</span>
        {selectedId === null && <Check size={14} />}
      </button>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {genres.map((g) => {
          const active = selectedId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g.id)}
              className={[
                "flex items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                active
                  ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-200"
                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5",
              ].join(" ")}
            >
              <span className="truncate">{g.name}</span>
              {active && <Check size={13} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SortPicker ───────────────────────────────────────────────────────────────
function SortPicker({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="p-1.5">
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={[
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-200 font-medium"
                : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <span>{o.label}</span>
            {active && <Check size={14} />}
          </button>
        );
      })}
    </div>
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
          ? "bg-primary-600/80 text-white"
          : "border border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-neutral-200",
      ].join(" ")}
    >
      {n}
    </button>
  );
}
