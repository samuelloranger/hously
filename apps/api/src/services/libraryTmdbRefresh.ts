import { prisma } from "@hously/api/db";
import { normalizeTmdbConfig } from "@hously/api/utils/plugins/normalizers";

const TMDB_BASE = "https://api.themoviedb.org/3";

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
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** Prefer US; type 4 = digital */
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

/** Fetch TMDB digital release and persist on library row. Returns new value (or null). */
export async function refreshLibraryMovieDigitalDate(
  mediaId: number,
): Promise<Date | null> {
  const key = await getTmdbApiKey();
  if (!key) return null;

  const m = await prisma.libraryMedia.findUnique({ where: { id: mediaId } });
  if (!m || m.type !== "movie") return null;

  const releaseDatesData = await tmdbFetch<{
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ type: number; release_date: string }>;
    }>;
  }>(`movie/${m.tmdbId}/release_dates`, key);

  const picked = pickDigitalRelease(releaseDatesData.results);
  await prisma.libraryMedia.update({
    where: { id: mediaId },
    data: { digitalReleaseDate: picked },
  });
  return picked;
}

/** Re-sync season/episode list from TMDB for a show (matches POST /api/library show upsert). */
export async function syncLibraryShowEpisodes(mediaId: number): Promise<void> {
  const key = await getTmdbApiKey();
  if (!key) return;

  const media = await prisma.libraryMedia.findUnique({ where: { id: mediaId } });
  if (!media || media.type !== "show") return;

  const details = await tmdbFetch<{
    seasons: Array<{ season_number: number; episode_count: number }>;
  }>(`tv/${media.tmdbId}`, key);

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
      }>(`tv/${media.tmdbId}/season/${s.season_number}`, key);

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
}
