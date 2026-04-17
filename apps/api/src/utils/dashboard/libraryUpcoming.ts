import { prisma } from "@hously/api/db";
import type { DashboardUpcomingItem } from "@hously/api/types/dashboardUpcoming";
import { toIsoDate } from "@hously/api/utils/dashboard/tmdbUpcoming";

const TMDB_WEB_BASE_URL = "https://www.themoviedb.org";

type LibraryMediaBase = {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  overview: string | null;
};

const mapToItem = (
  media: LibraryMediaBase,
  mediaType: "movie" | "tv",
  releaseDateIso: string,
): DashboardUpcomingItem => ({
  id: `${mediaType}-${media.tmdbId}`,
  title: media.title,
  media_type: mediaType,
  release_date: releaseDateIso,
  poster_url: media.posterUrl,
  backdrop_url: null,
  overview: media.overview,
  tmdb_url: `${TMDB_WEB_BASE_URL}/${mediaType}/${media.tmdbId}`,
  providers: [],
  vote_average: null,
});

/**
 * Collect upcoming TV episodes and movies from the user's library within the
 * date window. For shows, returns one entry per series (earliest upcoming
 * episode). Items bypass popularity filters — the user is already tracking them.
 */
export const collectLibraryUpcoming = async (
  fromDateIso: string,
  toDateIso: string,
): Promise<DashboardUpcomingItem[]> => {
  const fromDate = new Date(`${fromDateIso}T00:00:00.000Z`);
  const toDate = new Date(`${toDateIso}T23:59:59.999Z`);

  const [episodes, movies] = await Promise.all([
    prisma.libraryEpisode.findMany({
      where: {
        airDate: { gte: fromDate, lte: toDate },
        monitored: true,
        media: { type: "show", monitored: true },
      },
      orderBy: { airDate: "asc" },
      include: {
        media: {
          select: {
            tmdbId: true,
            title: true,
            posterUrl: true,
            overview: true,
          },
        },
      },
    }),
    prisma.libraryMedia.findMany({
      where: {
        type: "movie",
        monitored: true,
        digitalReleaseDate: { gte: fromDate, lte: toDate },
      },
      select: {
        tmdbId: true,
        title: true,
        posterUrl: true,
        overview: true,
        digitalReleaseDate: true,
      },
    }),
  ]);

  const byMediaId = new Map<number, DashboardUpcomingItem>();
  for (const ep of episodes) {
    if (!ep.airDate) continue;
    if (byMediaId.has(ep.mediaId)) continue; // earliest wins (already sorted)
    byMediaId.set(ep.mediaId, mapToItem(ep.media, "tv", toIsoDate(ep.airDate)));
  }

  const movieItems = movies
    .filter((m) => m.digitalReleaseDate)
    .map((m) => mapToItem(m, "movie", toIsoDate(m.digitalReleaseDate!)));

  return [...byMediaId.values(), ...movieItems];
};

/**
 * Merge upcoming items, preferring `base` on id collision. Use to add library
 * entries on top of a popularity-filtered TMDB list without clobbering TMDB
 * enrichment (providers, backdrops).
 */
export const mergeUpcomingById = (
  base: DashboardUpcomingItem[],
  additions: DashboardUpcomingItem[],
): DashboardUpcomingItem[] => {
  const seen = new Set(base.map((item) => item.id));
  const merged = [...base];
  for (const item of additions) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
};
