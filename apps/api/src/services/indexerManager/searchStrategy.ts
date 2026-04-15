import type { IndexerManagerAdapter, NormalizedRelease } from "./types";

interface TieredSearchOpts {
  query: string;
  tmdbId?: number | null;
  season?: number | null;
  complete?: boolean;
  mediaType?: "movie" | "tv";
}

/**
 * Tiered search strategy (mirrors Sonarr's approach).
 * Works with any IndexerManagerAdapter.
 */
export async function tieredSearch(
  adapter: IndexerManagerAdapter,
  opts: TieredSearchOpts,
): Promise<NormalizedRelease[]> {
  const { query, tmdbId, season, complete, mediaType } = opts;

  if (complete) {
    return completeSeriesSearch(adapter, query, tmdbId, mediaType);
  }

  if (season != null) {
    return seasonSearch(adapter, query, tmdbId, season, mediaType);
  }

  return adapter.search({ query, type: "freetext", mediaType });
}

async function seasonSearch(
  adapter: IndexerManagerAdapter,
  query: string,
  tmdbId: number | null | undefined,
  season: number,
  mediaType?: "movie" | "tv",
): Promise<NormalizedRelease[]> {
  const sN = String(season).padStart(2, "0");
  const mt = mediaType ?? "tv";

  const [tvById, tvByTitle, seasonEn, seasonFr, seasonScene] =
    await Promise.all([
      tmdbId != null
        ? adapter.search({ type: "tvsearch", tmdbId, season, mediaType: mt })
        : Promise.resolve([]),
      adapter.search({ type: "tvsearch", query, season, mediaType: mt }),
      adapter.search({
        type: "freetext",
        query: `${query} Season ${season}`,
        mediaType: mt,
      }),
      adapter.search({
        type: "freetext",
        query: `${query} Saison ${season}`,
        mediaType: mt,
      }),
      adapter.search({
        type: "freetext",
        query: `${query} S${sN}`,
        mediaType: mt,
      }),
    ]);

  return deduplicateByGuid([
    tvById,
    tvByTitle,
    seasonEn,
    seasonFr,
    seasonScene,
  ]);
}

async function completeSeriesSearch(
  adapter: IndexerManagerAdapter,
  query: string,
  tmdbId: number | null | undefined,
  mediaType?: "movie" | "tv",
): Promise<NormalizedRelease[]> {
  const mt = mediaType ?? "tv";
  const [tvById, tvByTitle, integrale, completeSeries] = await Promise.all([
    tmdbId != null
      ? adapter.search({ type: "tvsearch", tmdbId, mediaType: mt })
      : Promise.resolve([]),
    adapter.search({ type: "tvsearch", query, mediaType: mt }),
    adapter.search({
      type: "freetext",
      query: `${query} integrale`,
      mediaType: mt,
    }),
    adapter.search({
      type: "freetext",
      query: `${query} complete series`,
      mediaType: mt,
    }),
  ]);

  return deduplicateByGuid([tvById, tvByTitle, integrale, completeSeries]);
}

function deduplicateByGuid(
  batches: NormalizedRelease[][],
): NormalizedRelease[] {
  const seen = new Set<string>();
  const result: NormalizedRelease[] = [];
  for (const batch of batches) {
    for (const release of batch) {
      if (release.guid && !seen.has(release.guid)) {
        seen.add(release.guid);
        result.push(release);
      }
    }
  }
  return result;
}
