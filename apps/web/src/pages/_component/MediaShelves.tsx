import { useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardJellyfinLatestInfinite } from "@/pages/_component/useDashboardJellyfin";
import { useDashboardUpcoming } from "@/pages/_component/useDashboardUpcoming";
import type {
  DashboardUpcomingItem,
  TmdbMediaSearchItem,
} from "@hously/shared/types";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";
import type { LucideIcon } from "lucide-react";
import {
  RefreshCw,
  Clapperboard,
  Tv,
  Disc,
  Headphones,
  Film,
} from "lucide-react";

// ─── Poster card ──────────────────────────────────────────────────────────────

function PosterCard({
  title,
  subtitle,
  posterUrl,
  FallbackIcon,
  type,
  onClick,
  href,
  delayMs = 0,
}: {
  title: string;
  subtitle: string;
  posterUrl?: string | null;
  FallbackIcon: LucideIcon;
  type: string;
  onClick?: () => void;
  href?: string;
  delayMs?: number;
}) {
  const inner = (
    <div
      className="home-poster-card relative w-[120px] md:w-[140px] shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 cursor-pointer group"
      style={{ animationDelay: `${delayMs}ms` }}
      onClick={onClick}
    >
      <div className="aspect-[2/3] overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-200 dark:bg-zinc-700">
            <FallbackIcon className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute top-2 left-2">
        <span className="text-[9px] font-bold uppercase tracking-wide bg-black/60 text-white/90 rounded px-1.5 py-0.5">
          {type}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">
          {title}
        </p>
        <p className="text-[9px] text-white/60 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Jellyfin shelf ───────────────────────────────────────────────────────────

export function JellyfinShelf() {
  const { t, i18n } = useTranslation("common");
  const locale = resolveDateFnsLocale(i18n.language);
  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useDashboardJellyfinLatestInfinite(10);

  const isEnabled = data?.pages[0]?.enabled ?? false;

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (
      data?.pages
        .flatMap((p) => p.items)
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }) ?? []
    );
  }, [data?.pages]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) return;
    const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
    if (scrollWidth - scrollLeft - clientWidth < 400) fetchNextPage();
  };

  const mediaTypeLabel = (type: string | null) => {
    if (!type) return t("dashboard.home.mediaTypeGeneric");
    const key = type.toLowerCase();
    if (key === "movie") return t("dashboard.home.mediaTypeMovie");
    if (key === "episode") return t("dashboard.home.mediaTypeTv");
    if (key === "musicalbum") return t("dashboard.home.mediaTypeAlbum");
    if (key === "audio") return t("dashboard.home.mediaTypeAudio");
    return t("dashboard.home.mediaTypeGeneric");
  };

  const mediaFallback = (type: string | null): LucideIcon => {
    const map: Record<string, LucideIcon> = {
      movie: Clapperboard,
      episode: Tv,
      musicalbum: Disc,
      audio: Headphones,
    };
    return (type ? map[type.toLowerCase()] : undefined) ?? Film;
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-blue-500 shrink-0" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {t("dashboard.home.jellyfinRecentlyAdded")}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-zinc-400 hover:text-blue-500 transition-colors disabled:opacity-40"
          title={t("dashboard.jellyfin.refresh")}
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isError ? (
        <p className="px-4 py-6 text-sm text-rose-500 text-center">
          {t("dashboard.home.jellyfinLoadError")}
        </p>
      ) : isLoading ? (
        <div className="flex gap-3 px-4 py-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-[120px] md:w-[140px] shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse aspect-[2/3]"
            />
          ))}
        </div>
      ) : !isEnabled ? (
        <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
          {t("dashboard.home.jellyfinNotConfigured")}
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
          {t("dashboard.home.jellyfinEmpty")}
        </p>
      ) : (
        <div
          className="no-scrollbar overflow-x-auto px-4 py-3"
          onScroll={handleScroll}
        >
          <div className="flex gap-3">
            {items.map((item, i) => (
              <PosterCard
                key={`${item.id}-${i}`}
                title={item.title}
                subtitle={formatRelativeTime(item.added_at, { locale }) ?? ""}
                posterUrl={item.poster_url}
                FallbackIcon={mediaFallback(item.item_type)}
                type={mediaTypeLabel(item.item_type)}
                href={item.item_url || undefined}
                delayMs={i * 40}
              />
            ))}
            {isFetchingNextPage && (
              <div className="w-[120px] md:w-[140px] shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 aspect-[2/3] animate-pulse" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Upcoming shelf ───────────────────────────────────────────────────────────

function toTmdbItem(item: DashboardUpcomingItem): TmdbMediaSearchItem {
  const tmdbId = parseInt(item.id.split("-")[1] || "", 10);
  const releaseYear = item.release_date
    ? new Date(item.release_date).getFullYear()
    : null;
  return {
    id: item.id,
    tmdb_id: tmdbId,
    media_type: item.media_type,
    title: item.title,
    release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: item.vote_average ?? null,
    already_exists: false,
    can_add: true,
    source_id: null,
  };
}

export function UpcomingShelf() {
  const { t } = useTranslation("common");
  const { data, isLoading, isFetching, refetch } = useDashboardUpcoming();
  const [selected, setSelected] = useState<TmdbMediaSearchItem | null>(null);

  const formatDate = (value: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {t("dashboard.home.upcomingShelfTitle")}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!data?.enabled || isFetching}
            className="text-zinc-400 hover:text-amber-500 transition-colors disabled:opacity-40"
            title={t("dashboard.upcoming.refresh")}
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex gap-3 px-4 py-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[120px] md:w-[140px] shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse aspect-[2/3]"
              />
            ))}
          </div>
        ) : !data?.enabled ? (
          <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            {t("dashboard.home.upcomingArrNotConfigured")}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            {t("dashboard.home.upcomingEmpty")}
          </p>
        ) : (
          <div className="no-scrollbar overflow-x-auto px-4 py-3">
            <div className="flex gap-3">
              {data.items.map((item, i) => (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  subtitle={
                    formatDate(item.release_date) ??
                    t("dashboard.upcoming.unknownDate")
                  }
                  posterUrl={item.poster_url}
                  FallbackIcon={item.media_type === "movie" ? Clapperboard : Tv}
                  type={
                    item.media_type === "movie"
                      ? t("dashboard.upcoming.movie")
                      : t("dashboard.upcoming.tv")
                  }
                  onClick={() => setSelected(toTmdbItem(item))}
                  delayMs={i * 40}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {selected && (
        <ExploreCardDetailDialog
          item={selected}
          isOpen
          onClose={() => setSelected(null)}
          onAdded={() => {
            setSelected(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
