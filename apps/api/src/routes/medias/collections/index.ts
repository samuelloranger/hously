import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { normalizeRadarrConfig } from "@hously/api/utils/plugins/normalizers";
import { serverError } from "@hously/api/errors";
import { fetchRadarrTmdbIds, buildArrItemUrl, type ArrEntry } from "@hously/api/utils/medias/mappers";
import {
  loadTmdbConfig,
  fetchMediaDetails,
  fetchCollectionDetails,
} from "@hously/api/utils/medias/tmdbFetchers";

export const mediasCollectionsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/collections/missing", async ({ set }) => {
    try {
      const [tmdbConfig, radarrPlugin] = await Promise.all([
        loadTmdbConfig(),
        prisma.plugin.findFirst({
          where: { type: "radarr" },
          select: { enabled: true, config: true },
        }),
      ]);

      const radarrConfig = radarrPlugin?.enabled
        ? normalizeRadarrConfig(radarrPlugin.config)
        : null;
      if (!tmdbConfig || !radarrConfig) return { collections: [] };

      // Fetch all Radarr movies
      const radarrIds = await fetchRadarrTmdbIds(
        radarrConfig.website_url,
        radarrConfig.api_key,
      );
      const tmdbIds = Array.from(radarrIds.keys());

      // Fetch TMDB details for all Radarr movies in batches of 15 (uses 24h cache)
      const BATCH_SIZE = 15;
      const detailsMap = new Map<
        number,
        Awaited<ReturnType<typeof fetchMediaDetails>>
      >();
      for (let i = 0; i < tmdbIds.length; i += BATCH_SIZE) {
        const batch = tmdbIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((id) =>
            fetchMediaDetails(tmdbConfig.api_key, "movie", id).catch(
              () => null,
            ),
          ),
        );
        batch.forEach((id, j) => {
          if (results[j]) detailsMap.set(id, results[j]!);
        });
      }

      // Collect unique collection IDs
      const collectionIds = new Set<number>();
      for (const details of detailsMap.values()) {
        if (details.belongs_to_collection) {
          collectionIds.add(details.belongs_to_collection.id);
        }
      }

      if (collectionIds.size === 0) return { collections: [] };

      // Fetch collection data from TMDB (cached 24h per collection)
      const collectionResults = await Promise.all(
        Array.from(collectionIds).map((id) =>
          fetchCollectionDetails(tmdbConfig.api_key, id),
        ),
      );

      // Build response — annotate each movie with library status
      const collections = collectionResults
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((collection) => {
          const movies = collection.parts.map((part) => {
            const entry: ArrEntry | undefined = radarrIds.get(part.tmdb_id);
            const already_exists = Boolean(entry);
            const source_id = entry?.sourceId ?? null;
            let arr_url: string | null = null;
            if (radarrConfig.website_url && entry) {
              arr_url = buildArrItemUrl(
                radarrConfig.website_url,
                "radarr",
                String(part.tmdb_id),
              );
            }
            return {
              id: String(part.tmdb_id),
              tmdb_id: part.tmdb_id,
              media_type: "movie" as const,
              title: part.title,
              release_year: part.release_year,
              poster_url: part.poster_url,
              overview: part.overview,
              vote_average: part.vote_average,
              service: "radarr" as const,
              already_exists,
              can_add: !already_exists,
              source_id,
              arr_url,
            };
          });

          const owned_count = movies.filter((m) => m.already_exists).length;
          const missing_count = movies.length - owned_count;

          return {
            id: collection.id,
            name: collection.name,
            overview: collection.overview,
            poster_url: collection.poster_url,
            backdrop_url: collection.backdrop_url,
            movies,
            owned_count,
            total_count: movies.length,
            missing_count,
          };
        })
        .filter((c) => c.missing_count > 0 && c.owned_count > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { collections };
    } catch (error) {
      console.error("Error fetching missing collections:", error);
      return serverError(set, "Failed to fetch missing collections");
    }
  });
