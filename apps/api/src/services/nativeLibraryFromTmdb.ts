import type { Prisma } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { normalizeTmdbConfig } from "@hously/api/utils/plugins/normalizers";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export const libraryMediaInclude = {
  qualityProfile: { select: { id: true, name: true } },
} as const;

export type LibraryMediaWithProfile = Prisma.LibraryMediaGetPayload<{
  include: typeof libraryMediaInclude;
}>;

async function getTmdbApiKey(): Promise<string | null> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: "tmdb" },
    select: { enabled: true, config: true },
  });
  if (!plugin?.enabled) return null;
  const cfg = normalizeTmdbConfig(plugin.config);
  return cfg?.api_key ?? null;
}

async function tmdbFetch<T>(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}/${path}`);
  url.searchParams.set("api_key", apiKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function pickDigitalRelease(
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string }>;
  }>,
): Date | null {
  for (const country of ["US", ...results.map((r) => r.iso_3166_1)]) {
    const entry = results.find((r) => r.iso_3166_1 === country);
    const digital = entry?.release_dates.find((d) => d.type === 4);
    if (digital) return new Date(digital.release_date);
  }
  return null;
}

/**
 * Upsert native library media from TMDB (shared by POST /api/library and dashboard flows).
 */
export async function addOrUpdateLibraryFromTmdb(opts: {
  tmdb_id: number;
  type: "movie" | "show";
}): Promise<NonNullable<LibraryMediaWithProfile>> {
  const key = await getTmdbApiKey();
  if (!key) throw new Error("TMDB is not configured");

  const mediaSettings = await prisma.mediaSettings.findUnique({
    where: { id: 1 },
  });
  const defaultQualityProfileId =
    mediaSettings?.defaultQualityProfileId ?? null;

  const { tmdb_id, type } = opts;

  if (type === "movie") {
    const [details, releaseDatesData] = await Promise.all([
      tmdbFetch<{
        title: string;
        release_date: string;
        poster_path: string | null;
        overview: string;
      }>(`movie/${tmdb_id}`, key),
      tmdbFetch<{
        results: Array<{
          iso_3166_1: string;
          release_dates: Array<{ type: number; release_date: string }>;
        }>;
      }>(`movie/${tmdb_id}/release_dates`, key),
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
        sortTitle: details.title.replace(/^(the |a |an )/i, "").trim(),
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
        sortTitle: details.title.replace(/^(the |a |an )/i, "").trim(),
        year,
        posterUrl,
        overview: details.overview || null,
        digitalReleaseDate: pickDigitalRelease(releaseDatesData.results),
      },
      include: libraryMediaInclude,
    });
  }

  const details = await tmdbFetch<{
    name: string;
    first_air_date: string;
    poster_path: string | null;
    overview: string;
    seasons: Array<{ season_number: number; episode_count: number }>;
  }>(`tv/${tmdb_id}`, key);

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
      sortTitle: details.name.replace(/^(the |a |an )/i, "").trim(),
      year,
      status: "wanted",
      posterUrl,
      overview: details.overview || null,
    },
    update: {
      title: details.name,
      sortTitle: details.name.replace(/^(the |a |an )/i, "").trim(),
      year,
      posterUrl,
      overview: details.overview || null,
    },
    include: libraryMediaInclude,
  });

  const regularSeasons = details.seasons.filter((s) => s.season_number > 0);
  await Promise.all(
    regularSeasons.map(async (s) => {
      const seasonData = await tmdbFetch<{
        episodes: Array<{
          id: number;
          episode_number: number;
          name: string;
          air_date: string | null;
        }>;
      }>(`tv/${tmdb_id}/season/${s.season_number}`, key);

      await Promise.all(
        seasonData.episodes.map((ep) =>
          prisma.libraryEpisode.upsert({
            where: {
              mediaId_season_episode: {
                mediaId: media.id,
                season: s.season_number,
                episode: ep.episode_number,
              },
            },
            create: {
              mediaId: media.id,
              season: s.season_number,
              episode: ep.episode_number,
              title: ep.name || null,
              airDate: ep.air_date ? new Date(ep.air_date) : null,
              tmdbEpisodeId: ep.id,
            },
            update: {
              title: ep.name || null,
              airDate: ep.air_date ? new Date(ep.air_date) : null,
              tmdbEpisodeId: ep.id,
            },
          }),
        ),
      );
    }),
  );

  return media;
}
