import type { Prisma } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { TMDB_LANGUAGE_LIBRARY_PERSISTENCE } from "@hously/api/utils/medias/tmdbFetchers";
import {
  getLibraryTmdbApiKey,
  pickDigitalRelease,
  sortTitleFromName,
  tmdbApiFetch,
  upsertLibraryShowEpisodesFromTmdb,
} from "@hously/api/utils/medias/libraryHelpers";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export const libraryMediaInclude = {
  qualityProfile: { select: { id: true, name: true } },
} as const;

export type LibraryMediaWithProfile = Prisma.LibraryMediaGetPayload<{
  include: typeof libraryMediaInclude;
}>;

/**
 * Upsert library media from TMDB (shared by POST /api/library and dashboard flows).
 * Titles, overviews, and episode names are always fetched in English for stable DB storage.
 */
export async function addOrUpdateLibraryFromTmdb(opts: {
  tmdb_id: number;
  type: "movie" | "show";
}): Promise<NonNullable<LibraryMediaWithProfile>> {
  const key = await getLibraryTmdbApiKey();
  if (!key) throw new Error("TMDB is not configured");

  const mediaSettings = await prisma.mediaSettings.findUnique({
    where: { id: 1 },
  });
  const defaultQualityProfileId =
    mediaSettings?.defaultQualityProfileId ?? null;

  const { tmdb_id, type } = opts;
  const lang = { language: TMDB_LANGUAGE_LIBRARY_PERSISTENCE };

  if (type === "movie") {
    const [details, releaseDatesData] = await Promise.all([
      tmdbApiFetch<{
        title: string;
        release_date: string;
        poster_path: string | null;
        overview: string;
      }>(`movie/${tmdb_id}`, key, lang),
      tmdbApiFetch<{
        results: Array<{
          iso_3166_1: string;
          release_dates: Array<{ type: number; release_date: string }>;
        }>;
      }>(`movie/${tmdb_id}/release_dates`, key, lang),
    ]);

    const year = details.release_date
      ? parseInt(details.release_date.slice(0, 4), 10)
      : null;
    const posterUrl = details.poster_path
      ? `${TMDB_IMAGE_BASE}${details.poster_path}`
      : null;

    return prisma.libraryMedia.upsert({
      where: { tmdbId: tmdb_id },
      create: {
        tmdbId: tmdb_id,
        type: "movie",
        title: details.title,
        sortTitle: sortTitleFromName(details.title),
        year,
        status: "wanted",
        posterUrl,
        overview: details.overview || null,
        digitalReleaseDate: pickDigitalRelease(releaseDatesData.results),
        ...(defaultQualityProfileId != null
          ? { qualityProfileId: defaultQualityProfileId }
          : {}),
      },
      update: {
        title: details.title,
        sortTitle: sortTitleFromName(details.title),
        year,
        posterUrl,
        overview: details.overview || null,
        digitalReleaseDate: pickDigitalRelease(releaseDatesData.results),
      },
      include: libraryMediaInclude,
    });
  }

  const details = await tmdbApiFetch<{
    name: string;
    first_air_date: string;
    poster_path: string | null;
    overview: string;
    seasons: Array<{ season_number: number; episode_count: number }>;
  }>(`tv/${tmdb_id}`, key, lang);

  const year = details.first_air_date
    ? parseInt(details.first_air_date.slice(0, 4), 10)
    : null;
  const posterUrl = details.poster_path
    ? `${TMDB_IMAGE_BASE}${details.poster_path}`
    : null;

  const media = await prisma.libraryMedia.upsert({
    where: { tmdbId: tmdb_id },
    create: {
      tmdbId: tmdb_id,
      type: "show",
      title: details.name,
      sortTitle: sortTitleFromName(details.name),
      year,
      status: "wanted",
      posterUrl,
      overview: details.overview || null,
      ...(defaultQualityProfileId != null
        ? { qualityProfileId: defaultQualityProfileId }
        : {}),
    },
    update: {
      title: details.name,
      sortTitle: sortTitleFromName(details.name),
      year,
      posterUrl,
      overview: details.overview || null,
    },
    include: libraryMediaInclude,
  });

  await upsertLibraryShowEpisodesFromTmdb({
    mediaId: media.id,
    tmdbShowId: tmdb_id,
    apiKey: key,
    languageParams: lang,
  });

  return media;
}
