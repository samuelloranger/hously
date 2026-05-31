import { useMemo, useState, type ReactNode, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useDashboardJellyfinLatestInfinite } from "@/pages/_component/useDashboardJellyfin";
import {
  useDashboardUpcoming,
  useRefreshDashboardUpcoming,
} from "@/pages/_component/useDashboardUpcoming";
import { getDateYear } from "@hously/shared/utils/date";
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
  CalendarClock,
  PlayCircle,
} from "lucide-react";

// ─── Shelf section frame ────────────────────────────────────────────────────

function ShelfSection({
  Icon,
  title,
  count,
  onRefresh,
  refreshing,
  refreshDisabled,
  refreshTitle,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  count?: number;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled?: boolean;
  refreshTitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neutral-800 text-primary-400">
            <Icon className="w-4 h-4" strokeWidth={2} />
          </span>
          <h3 className="font-display text-sm font-semibold text-neutral-50 truncate">
            {title}
          </h3>
          {count != null && count > 0 && (
            <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 font-display text-[11px] font-semibold tabular-nums text-neutral-400">
              {count}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:text-primary-400 disabled:opacity-40"
          title={refreshTitle}
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
      {children}
    </section>
  );
}

function ShelfMessage({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={`px-4 py-8 text-center text-sm ${
        tone === "error" ? "text-rose-400" : "text-neutral-400"
      }`}
    >
      {children}
    </p>
  );
}

function ShelfSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="w-[120px] md:w-[140px] shrink-0 rounded-lg bg-neutral-800 animate-pulse aspect-[2/3]"
        />
      ))}
    </div>
  );
}

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
      className="home-poster-card relative w-[120px] md:w-[140px] shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 cursor-pointer group transition-colors hover:border-primary-400/60"
      style={{ animationDelay: `${delayMs}ms` }}
      onClick={onClick}
    >
      <div className="aspect-[2/3] overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-800">
            <FallbackIcon className="w-8 h-8 text-neutral-400" />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
      <div className="absolute top-2 left-2">
        <span className="rounded bg-neutral-950/70 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide text-neutral-100">
          {type}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[11px] font-semibold text-neutral-50 leading-tight line-clamp-2">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[9px] text-neutral-400">{subtitle}</p>
        )}
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
    <ShelfSection
      Icon={PlayCircle}
      title={t("dashboard.home.jellyfinRecentlyAdded")}
      count={isEnabled && !isLoading && !isError ? items.length : undefined}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      refreshDisabled={isFetching}
      refreshTitle={t("dashboard.jellyfin.refresh")}
    >
      {isError ? (
        <ShelfMessage tone="error">
          {t("dashboard.home.jellyfinLoadError")}
        </ShelfMessage>
      ) : isLoading ? (
        <ShelfSkeleton />
      ) : !isEnabled ? (
        <ShelfMessage>{t("dashboard.home.jellyfinNotConfigured")}</ShelfMessage>
      ) : items.length === 0 ? (
        <ShelfMessage>{t("dashboard.home.jellyfinEmpty")}</ShelfMessage>
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
              <div className="w-[120px] md:w-[140px] shrink-0 rounded-lg bg-neutral-800 aspect-[2/3] animate-pulse" />
            )}
          </div>
        </div>
      )}
    </ShelfSection>
  );
}

// ─── Upcoming shelf ───────────────────────────────────────────────────────────

function toTmdbItem(item: DashboardUpcomingItem): TmdbMediaSearchItem {
  const [source, numericPart] = item.id.split("-", 2);
  const tmdbId =
    source === "movie" || source === "tv"
      ? parseInt(numericPart || "", 10)
      : Number.NaN;
  const releaseYear = getDateYear(item.release_date);
  return {
    id: item.id,
    tmdb_id: Number.isFinite(tmdbId) ? tmdbId : 0,
    media_type: item.media_type,
    title: item.title,
    release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: item.vote_average ?? null,
    already_exists: item.library_id != null,
    can_add: item.library_id == null && Number.isFinite(tmdbId) && tmdbId > 0,
    source_id: null,
    library_id: item.library_id,
  };
}

export function UpcomingShelf() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data, isLoading, isFetching } = useDashboardUpcoming();
  const refreshUpcoming = useRefreshDashboardUpcoming();
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

  const formatEpisodeLabel = (item: DashboardUpcomingItem) => {
    if (
      item.media_type !== "tv" ||
      item.season_number == null ||
      item.episode_number == null
    ) {
      return null;
    }

    return `S${String(item.season_number).padStart(2, "0")}E${String(
      item.episode_number,
    ).padStart(2, "0")}`;
  };

  const formatUpcomingSubtitle = (item: DashboardUpcomingItem) => {
    const dateLabel =
      formatDate(item.release_date) ?? t("dashboard.upcoming.unknownDate");
    const episodeLabel = formatEpisodeLabel(item);
    return episodeLabel ? `${episodeLabel} · ${dateLabel}` : dateLabel;
  };

  const handleUpcomingClick = (item: DashboardUpcomingItem) => {
    if (item.library_id != null) {
      navigate({
        to: "/library/$libraryId",
        params: { libraryId: String(item.library_id) },
      });
      return;
    }

    setSelected(toTmdbItem(item));
  };

  return (
    <>
      <ShelfSection
        Icon={CalendarClock}
        title={t("dashboard.home.upcomingShelfTitle")}
        count={data?.enabled && !isLoading ? data.items.length : undefined}
        onRefresh={() => refreshUpcoming.mutate()}
        refreshing={isFetching || refreshUpcoming.isPending}
        refreshDisabled={
          !data?.enabled || isFetching || refreshUpcoming.isPending
        }
        refreshTitle={t("dashboard.upcoming.refresh")}
      >
        {isLoading ? (
          <ShelfSkeleton />
        ) : !data?.enabled ? (
          <ShelfMessage>
            {t("dashboard.home.upcomingArrNotConfigured")}
          </ShelfMessage>
        ) : data.items.length === 0 ? (
          <ShelfMessage>{t("dashboard.home.upcomingEmpty")}</ShelfMessage>
        ) : (
          <div className="no-scrollbar overflow-x-auto px-4 py-3">
            <div className="flex gap-3">
              {data.items.map((item, i) => (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  subtitle={formatUpcomingSubtitle(item)}
                  posterUrl={item.poster_url}
                  FallbackIcon={item.media_type === "movie" ? Clapperboard : Tv}
                  type={
                    item.media_type === "movie"
                      ? t("dashboard.upcoming.movie")
                      : t("dashboard.upcoming.tv")
                  }
                  onClick={() => handleUpcomingClick(item)}
                  delayMs={i * 40}
                />
              ))}
            </div>
          </div>
        )}
      </ShelfSection>

      {selected && (
        <ExploreCardDetailDialog
          item={selected}
          isOpen
          onClose={() => setSelected(null)}
          onAdded={() => {
            setSelected(null);
            refreshUpcoming.mutate();
          }}
        />
      )}
    </>
  );
}
