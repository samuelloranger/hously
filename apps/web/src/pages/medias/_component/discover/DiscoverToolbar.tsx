import { useTranslation } from "react-i18next";
import { Tv, Tag, ArrowDownUp } from "lucide-react";
import type { DiscoverFilters, SortOpt } from "./discoverTypes";
import { DISCOVER_LANGUAGE_FILTERS } from "./discoverConfig";
import { DiscoverFilterChip } from "./DiscoverFilterChip";
import {
  DiscoverGenrePicker,
  DiscoverServicePicker,
  DiscoverSortPicker,
} from "./DiscoverPickers";

export function DiscoverToolbar({
  mediaType,
  providerId,
  genreId,
  sortBy,
  originalLanguage,
  providers,
  genres,
  visibleSorts,
  activeProvider,
  activeGenre,
  activeSort,
  onMediaTypeChange,
  onProviderChange,
  onGenreChange,
  onSortChange,
  onLanguageToggle,
}: {
  mediaType: DiscoverFilters["mediaType"];
  providerId: number | null;
  genreId: number | null;
  sortBy: string;
  originalLanguage: string | null;
  providers: { id: number; name: string; logo_url: string }[];
  genres: { id: number; name: string }[];
  visibleSorts: SortOpt[];
  activeProvider: { id: number; name: string; logo_url: string } | null;
  activeGenre: { id: number; name: string } | null;
  activeSort: SortOpt | null;
  onMediaTypeChange: (type: "movie" | "tv") => void;
  onProviderChange: (id: number | null) => void;
  onGenreChange: (id: number | null) => void;
  onSortChange: (value: string) => void;
  onLanguageToggle: (code: string) => void;
}) {
  const { t } = useTranslation("common");

  return (
    <>
      <select
        value={mediaType}
        onChange={(e) => onMediaTypeChange(e.target.value as "movie" | "tv")}
        className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 dark:focus:border-primary-500 transition"
      >
        <option value="movie">{t("medias.movie_plural")}</option>
        <option value="tv">{t("medias.series_plural")}</option>
      </select>

      <div className="flex flex-wrap items-center gap-2">
        <DiscoverFilterChip
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
          onClear={activeProvider ? () => onProviderChange(null) : undefined}
          popoverContent={(close) => (
            <DiscoverServicePicker
              providers={providers.slice(0, 18)}
              selectedId={providerId}
              onSelect={(id) => {
                onProviderChange(id);
                close();
              }}
              allLabel={t("medias.discover.allServices", {
                defaultValue: "All services",
              })}
            />
          )}
        />

        <DiscoverFilterChip
          icon={Tag}
          label={t("medias.discover.genre", { defaultValue: "Genre" })}
          value={activeGenre?.name ?? null}
          onClear={activeGenre ? () => onGenreChange(null) : undefined}
          popoverContent={(close) => (
            <DiscoverGenrePicker
              genres={genres}
              selectedId={genreId}
              onSelect={(id) => {
                onGenreChange(id);
                close();
              }}
              allLabel={t("medias.discover.allGenres", {
                defaultValue: "All genres",
              })}
            />
          )}
        />

        <DiscoverFilterChip
          icon={ArrowDownUp}
          label={t("medias.discover.sort", { defaultValue: "Sort" })}
          value={activeSort ? t(activeSort.labelKey) : null}
          popoverContent={(close) => (
            <DiscoverSortPicker
              options={visibleSorts.map((s) => ({
                value: s.value,
                label: t(s.labelKey),
              }))}
              selected={sortBy}
              onSelect={(value) => {
                onSortChange(value);
                close();
              }}
            />
          )}
        />

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600 dark:text-neutral-500">
            {t("medias.discover.lang")}
          </span>
          {DISCOVER_LANGUAGE_FILTERS.map((lf) => {
            const active = originalLanguage === lf.code;
            return (
              <button
                key={lf.code}
                type="button"
                onClick={() => onLanguageToggle(lf.code)}
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
    </>
  );
}
