import { useTranslation } from "react-i18next";
import { type TmdbMediaSearchItem } from "@hously/shared/types";
import type {
  TmdbMediaDetailsResponse,
  MediaRatingsResponse,
  TmdbCreditsResponse,
  TmdbCollection,
} from "@hously/shared/types";
import { Clock, Film, Star } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTmdbDateYmd(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

interface ExploreCardHeroProps {
  item: TmdbMediaSearchItem;
  detailsData: TmdbMediaDetailsResponse | null;
  ratingsData: MediaRatingsResponse | null;
  creditsData: TmdbCreditsResponse | null;
  heroBackdropUrl: string | null;
  heroBackdropLoaded: boolean;
  heroVisualReady: boolean;
  posterLoaded: boolean;
  imageError: boolean;
  runtimeStr: string | null;
  collection: TmdbCollection | null;
  voteAverage: number | null;
  onBackdropLoaded: (url: string) => void;
  onPosterLoaded: () => void;
  onImageError: () => void;
}

export function ExploreCardHero({
  item,
  detailsData,
  ratingsData,
  creditsData,
  heroBackdropUrl,
  heroBackdropLoaded,
  heroVisualReady,
  posterLoaded,
  imageError,
  runtimeStr,
  collection,
  voteAverage,
  onBackdropLoaded,
  onPosterLoaded,
  onImageError,
}: ExploreCardHeroProps) {
  const { t } = useTranslation("common");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-t-2xl transition-[min-height] duration-500 ease-out",
        heroBackdropUrl ? "min-h-[200px]" : "min-h-0",
        !heroBackdropUrl && "px-5 pt-5 pb-3",
      )}
    >
      {heroBackdropUrl ? (
        <>
          <div
            className="absolute inset-0 bg-neutral-900 dark:bg-neutral-950"
            aria-hidden
          />
          <img
            src={heroBackdropUrl}
            alt=""
            loading="eager"
            decoding="async"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
              heroBackdropLoaded
                ? "opacity-100 scale-100"
                : "opacity-0 scale-[1.03]",
            )}
            onLoad={() => onBackdropLoaded(heroBackdropUrl)}
          />
          <div
            className={cn(
              "absolute inset-0 bg-black/75 transition-opacity duration-500 ease-out motion-reduce:transition-none",
              heroBackdropLoaded ? "opacity-100" : "opacity-90",
            )}
            aria-hidden
          />
        </>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex gap-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          heroBackdropUrl ? "px-5 pb-4 pt-5 text-white" : "px-0 py-1 pt-0",
          heroVisualReady
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-[0.92]",
        )}
      >
        {/* Poster thumbnail */}
        <div className="shrink-0">
          {item.poster_url && !imageError ? (
            <img
              src={item.poster_url}
              alt={item.title}
              className={cn(
                "w-[88px] rounded-xl object-cover shadow-md ring-1 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                heroBackdropUrl
                  ? "ring-white/25"
                  : "ring-black/10 dark:ring-white/10",
                posterLoaded
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1",
              )}
              onLoad={onPosterLoaded}
              onError={onImageError}
            />
          ) : (
            <div
              className={cn(
                "flex h-32 w-[88px] items-center justify-center rounded-xl transition-opacity duration-500 motion-reduce:transition-none",
                heroVisualReady ? "opacity-100" : "opacity-80",
                heroBackdropUrl
                  ? "bg-white/15 ring-1 ring-white/20"
                  : "bg-neutral-200 dark:bg-neutral-700",
              )}
            >
              <Film className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
            </div>
          )}
        </div>

        {/* Meta column */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          {/* Title */}
          <h2
            className={cn(
              "text-xl font-semibold leading-snug",
              heroBackdropUrl
                ? "text-white"
                : "text-neutral-900 dark:text-white",
            )}
          >
            {item.title}
          </h2>

          {detailsData?.tagline && (
            <p
              className={cn(
                "text-sm italic leading-snug",
                heroBackdropUrl
                  ? "text-white/85"
                  : "text-neutral-600 dark:text-neutral-400",
              )}
            >
              {detailsData.tagline}
            </p>
          )}

          {/* Type + year + runtime */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-primary-600/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {item.media_type === "movie"
                ? t("medias.movie")
                : t("medias.series")}
            </span>
            {item.release_year && (
              <span
                className={cn(
                  "text-xs",
                  heroBackdropUrl
                    ? "text-white/75"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                {item.release_year}
              </span>
            )}
            {runtimeStr && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs",
                  heroBackdropUrl
                    ? "text-white/75"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                <Clock size={10} />
                {runtimeStr}
              </span>
            )}
            {detailsData?.number_of_seasons != null && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs",
                  heroBackdropUrl
                    ? "text-white/75"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                <Film size={10} />
                {detailsData.number_of_seasons}S ·{" "}
                {detailsData.number_of_episodes}E
              </span>
            )}
          </div>

          {/* Ratings */}
          <div className="flex flex-wrap items-center gap-3">
            {voteAverage != null && (
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                <Star size={12} className="fill-amber-400" />
                {voteAverage.toFixed(1)}
                <span
                  className={cn(
                    "text-[10px] font-normal",
                    heroBackdropUrl ? "text-white/60" : "text-neutral-400",
                  )}
                >
                  TMDB
                </span>
              </span>
            )}
            {ratingsData?.rotten_tomatoes &&
              (() => {
                const score = parseInt(ratingsData.rotten_tomatoes);
                const isFresh = score >= 60;
                return (
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <img
                      src={
                        isFresh
                          ? "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-fresh.149b5e8adc3.svg"
                          : "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-rotten.f1ef4f02ce3.svg"
                      }
                      alt={isFresh ? "Fresh" : "Rotten"}
                      className="h-4 w-4"
                    />
                    <span
                      className={cn(
                        isFresh
                          ? "text-red-300"
                          : heroBackdropUrl
                            ? "text-white/70"
                            : "text-neutral-400",
                      )}
                    >
                      {ratingsData.rotten_tomatoes}
                    </span>
                  </span>
                );
              })()}
            {ratingsData?.metacritic && (
              <span className="flex items-center gap-1 text-sm font-semibold">
                <svg
                  viewBox="0 0 32 32"
                  className="h-4 w-4"
                  aria-label="Metacritic"
                >
                  <circle cx="16" cy="16" r="16" fill="#FFCC34" />
                  <text
                    x="16"
                    y="22"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                    fill="#000"
                  >
                    M
                  </text>
                </svg>
                <span
                  className={cn(
                    heroBackdropUrl
                      ? "text-white/90"
                      : "text-neutral-700 dark:text-neutral-300",
                  )}
                >
                  {ratingsData.metacritic}
                </span>
              </span>
            )}
          </div>

          {(detailsData?.genres?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {(detailsData?.genres ?? []).map((g) => (
                <span
                  key={g.id}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    heroBackdropUrl
                      ? "bg-white/15 text-white ring-1 ring-white/25"
                      : "bg-neutral-200/90 text-neutral-700 dark:bg-neutral-700/70 dark:text-neutral-300",
                  )}
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {item.media_type === "movie" &&
            formatTmdbDateYmd(detailsData?.release_date) && (
              <p
                className={cn(
                  "text-xs",
                  heroBackdropUrl
                    ? "text-white/80"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                <span
                  className={
                    heroBackdropUrl
                      ? "text-white/55"
                      : "text-neutral-400 dark:text-neutral-500"
                  }
                >
                  {t("medias.detail.releaseDate")}{" "}
                </span>
                {formatTmdbDateYmd(detailsData?.release_date)}
              </p>
            )}

          {item.media_type === "tv" &&
            (formatTmdbDateYmd(detailsData?.first_air_date) ||
              formatTmdbDateYmd(detailsData?.last_air_date) ||
              detailsData?.status) && (
              <p
                className={cn(
                  "text-xs",
                  heroBackdropUrl
                    ? "text-white/80"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                {[
                  formatTmdbDateYmd(detailsData?.first_air_date) &&
                    `${t("medias.detail.firstAir")} ${formatTmdbDateYmd(detailsData?.first_air_date)}`,
                  formatTmdbDateYmd(detailsData?.last_air_date) &&
                    `${t("medias.detail.lastAir")} ${formatTmdbDateYmd(detailsData?.last_air_date)}`,
                  detailsData?.status &&
                    `${t("medias.detail.showStatus")} ${detailsData.status}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

          {/* Director */}
          {creditsData?.directors && creditsData.directors.length > 0 && (
            <p
              className={cn(
                "text-xs",
                heroBackdropUrl
                  ? "text-white/80"
                  : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              <span
                className={
                  heroBackdropUrl
                    ? "text-white/55"
                    : "text-neutral-400 dark:text-neutral-500"
                }
              >
                {t("medias.detail.director")}{" "}
              </span>
              <span
                className={cn(
                  "font-medium",
                  heroBackdropUrl
                    ? "text-white"
                    : "text-neutral-600 dark:text-neutral-300",
                )}
              >
                {creditsData.directors.join(", ")}
              </span>
            </p>
          )}

          {/* Collection */}
          {collection && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  heroBackdropUrl
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-primary-500/25 bg-primary-500/8 text-primary-600 dark:text-primary-400",
                )}
              >
                <span className="shrink-0">
                  {t("medias.detail.partOfCollection")}
                </span>
                <span className="truncate">{collection.name}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
