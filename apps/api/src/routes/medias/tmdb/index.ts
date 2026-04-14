import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { getPluginConfigRecord } from "@hously/api/services/pluginConfigCache";
import { normalizeTmdbConfig } from "@hously/api/utils/plugins/normalizers";
import { getJsonCache, setJsonCache } from "@hously/api/services/cache";
import { badGateway, badRequest, serverError } from "@hously/api/errors";
import {
  type TmdbSearchItem,
  mapTmdbSearchItem,
  toRecord,
  toStringOrNull,
  toNumberOrNull,
} from "@hously/api/utils/medias/mappers";
import {
  loadTmdbConfig,
  fetchTrailer,
  fetchRatings,
  fetchCredits,
  emptyMediaDetails,
  fetchMediaDetails,
  fetchWatchProviders,
  toTmdbLanguage,
} from "@hously/api/utils/medias/tmdbFetchers";

export const mediasTmdbRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/tmdb-search",
    async ({ user, set, query }) => {
      const q = query.q.trim();
      if (q.length < 2) {
        return {
          enabled: true,
          items: [],
        };
      }

      const response: {
        enabled: boolean;
        items: TmdbSearchItem[];
      } = {
        enabled: true,
        items: [],
      };

      try {
        const tmdbPlugin = await getPluginConfigRecord("tmdb");

        const tmdbConfig = tmdbPlugin?.enabled
          ? normalizeTmdbConfig(tmdbPlugin.config)
          : null;
        if (!tmdbConfig) {
          return badRequest(set, "TMDB is not configured");
        }

        const searchUrl = new URL("https://api.themoviedb.org/3/search/multi");
        const language = toTmdbLanguage(
          (query as Record<string, string | undefined>).language || "en-US",
        );
        searchUrl.searchParams.set("api_key", tmdbConfig.api_key);
        searchUrl.searchParams.set("query", q);
        searchUrl.searchParams.set("include_adult", "false");
        searchUrl.searchParams.set("language", language);
        searchUrl.searchParams.set("page", "1");

        const searchRes = await fetch(searchUrl.toString(), {
          headers: { Accept: "application/json" },
        });
        if (!searchRes.ok) {
          return badGateway(
            set,
            `TMDB search failed with status ${searchRes.status}`,
          );
        }

        const searchData = (await searchRes.json()) as Record<string, unknown>;
        let items = (
          Array.isArray(searchData.results) ? searchData.results : []
        )
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .slice(0, 20);

        // Check which TMDB IDs are already in the library
        const tmdbIds = items.map((i) => i.tmdb_id);
        const libraryEntries = await prisma.libraryMedia.findMany({
          where: { tmdbId: { in: tmdbIds } },
          select: { tmdbId: true, id: true },
        });
        const libraryIdByTmdbId = new Map(
          libraryEntries.map((e) => [e.tmdbId, e.id]),
        );

        items = items.map((item) => ({
          ...item,
          service: "prowlarr" as const,
          already_exists: libraryIdByTmdbId.has(item.tmdb_id),
          can_add: true,
          source_id: null,
          library_id: libraryIdByTmdbId.get(item.tmdb_id) ?? null,
        }));

        response.items = items;
        return response;
      } catch (error) {
        console.error("Error searching TMDB medias:", error);
        return serverError(set, "Failed to search TMDB medias");
      }
    },
    {
      query: t.Object({
        q: t.String(),
        language: t.Optional(t.String()),
      }),
    },
  )
  .get("/explore", async ({ user, set, query }) => {
    try {
      const tmdbPlugin = await getPluginConfigRecord("tmdb");

      const tmdbConfig = tmdbPlugin?.enabled
        ? normalizeTmdbConfig(tmdbPlugin.config)
        : null;
      if (!tmdbConfig) {
        return badRequest(set, "TMDB is not configured");
      }

      const language = toTmdbLanguage(
        (query as Record<string, string | undefined>).language || "en-US",
      );
      const skipCache =
        (query as Record<string, string | undefined>).skipCache === "true";

      const fetchTmdb = async (
        path: string,
        extra?: Record<string, string>,
      ) => {
        const url = new URL(`https://api.themoviedb.org/3/${path}`);
        url.searchParams.set("api_key", tmdbConfig.api_key);
        url.searchParams.set("language", language);
        if (extra) {
          for (const [k, v] of Object.entries(extra)) {
            url.searchParams.set(k, v);
          }
        }
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as Record<string, unknown>;
        return Array.isArray(data.results) ? data.results : [];
      };

      const injectMediaType = (type: "movie" | "tv") => (items: unknown[]) =>
        items.map((item) =>
          typeof item === "object" && item !== null
            ? { ...item, media_type: type }
            : item,
        );

      const [
        trending,
        popularMovies,
        popularShows,
        upcomingMovies,
        nowPlaying,
        airingToday,
        onTheAir,
        topRatedMovies,
        topRatedShows,
      ] = await Promise.all([
        fetchTmdb("trending/all/day"),
        fetchTmdb("movie/popular").then(injectMediaType("movie")),
        fetchTmdb("tv/popular").then(injectMediaType("tv")),
        fetchTmdb("movie/upcoming").then(injectMediaType("movie")),
        fetchTmdb("movie/now_playing").then(injectMediaType("movie")),
        fetchTmdb("tv/airing_today").then(injectMediaType("tv")),
        fetchTmdb("tv/on_the_air").then(injectMediaType("tv")),
        fetchTmdb("movie/top_rated").then(injectMediaType("movie")),
        fetchTmdb("discover/tv", {
          sort_by: "vote_average.desc",
          with_origin_country: "US|CA",
          "vote_count.gte": "200",
          without_genres: "16", // exclude animation/anime
        }).then(injectMediaType("tv")),
      ]);

      const libraryAllEntries = await prisma.libraryMedia.findMany({
        select: { tmdbId: true, id: true, type: true },
      });

      const libraryIdByTmdbId = new Map(
        libraryAllEntries.map((e) => [e.tmdbId, e.id]),
      );

      const normalize = (items: unknown[]) =>
        items
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .map((item) => {
            const libId = libraryIdByTmdbId.get(item.tmdb_id);
            return {
              ...item,
              service: "prowlarr" as const,
              already_exists: libId != null,
              can_add: true,
              source_id: null,
              library_id: libId ?? null,
            };
          });

      const recommendationsCacheKey = `medias:explore:recommendations:${language}`;

      let recommended: TmdbSearchItem[] = [];
      if (!skipCache) {
        const cachedRecommendations = await getJsonCache<TmdbSearchItem[]>(
          recommendationsCacheKey,
        );
        if (cachedRecommendations) {
          recommended = cachedRecommendations;
        }
      }

      if (!recommended.length) {
        const movieTmdbIds = libraryAllEntries
          .filter((e) => e.type === "movie")
          .map((e) => e.tmdbId);
        const showTmdbIds = libraryAllEntries
          .filter((e) => e.type === "show")
          .map((e) => e.tmdbId);

        const shuffle = <T>(arr: T[]): T[] => {
          const copy = [...arr];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };
        const sampleMovieIds = shuffle(movieTmdbIds).slice(0, 5);
        const sampleShowIds = shuffle(showTmdbIds).slice(0, 4);

        const recResults = await Promise.all([
          ...sampleMovieIds.map((id) =>
            fetchTmdb(`movie/${id}/recommendations`)
              .then(injectMediaType("movie"))
              .catch(() => [] as unknown[]),
          ),
          ...sampleShowIds.map((id) =>
            fetchTmdb(`tv/${id}/recommendations`)
              .then(injectMediaType("tv"))
              .catch(() => [] as unknown[]),
          ),
        ]);

        const allExisting = new Set(libraryAllEntries.map((e) => e.tmdbId));
        const seen = new Set<number>();

        recommended = normalize(recResults.flat())
          .filter((item) => {
            if (seen.has(item.tmdb_id) || allExisting.has(item.tmdb_id))
              return false;
            seen.add(item.tmdb_id);
            return true;
          })
          .slice(0, 20);

        if (recommended.length > 0) {
          await setJsonCache(recommendationsCacheKey, recommended, 60 * 60);
        }
      }

      return {
        trending: normalize(trending),
        popular_movies: normalize(popularMovies),
        popular_shows: normalize(popularShows),
        upcoming_movies: normalize(upcomingMovies),
        now_playing: normalize(nowPlaying),
        airing_today: normalize(airingToday),
        on_the_air: normalize(onTheAir),
        top_rated_movies: normalize(topRatedMovies),
        top_rated_shows: normalize(topRatedShows),
        recommended,
      };
    } catch (error) {
      console.error("Error fetching TMDB explore:", error);
      return serverError(set, "Failed to fetch TMDB explore");
    }
  })
  .get("/explore/:category", async ({ user, set, params, query }) => {
    const categoryPaths: Record<
      string,
      { path: string; type?: "movie" | "tv" }
    > = {
      trending: { path: "trending/all/day" },
      popular_movies: { path: "movie/popular", type: "movie" },
      popular_shows: { path: "tv/popular", type: "tv" },
      upcoming_movies: { path: "movie/upcoming", type: "movie" },
      now_playing: { path: "movie/now_playing", type: "movie" },
      airing_today: { path: "tv/airing_today", type: "tv" },
      on_the_air: { path: "tv/on_the_air", type: "tv" },
      top_rated_movies: { path: "movie/top_rated", type: "movie" },
      top_rated_shows: { path: "tv/top_rated", type: "tv" },
    };

    const category = (params as Record<string, string>).category;
    const config = categoryPaths[category];
    if (!config) {
      return badRequest(set, `Unknown category: ${category}`);
    }

    try {
      const tmdbPlugin = await getPluginConfigRecord("tmdb");

      const tmdbConfig = tmdbPlugin?.enabled
        ? normalizeTmdbConfig(tmdbPlugin.config)
        : null;
      if (!tmdbConfig) {
        return badRequest(set, "TMDB is not configured");
      }

      const q = query as Record<string, string | undefined>;
      const language = toTmdbLanguage(q.language || "en-US");
      const page = parseInt(q.page || "1", 10);

      const url = new URL(`https://api.themoviedb.org/3/${config.path}`);
      url.searchParams.set("api_key", tmdbConfig.api_key);
      url.searchParams.set("language", language);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return badGateway(set, "TMDB request failed");
      }

      const data = (await res.json()) as Record<string, unknown>;
      let items = Array.isArray(data.results) ? data.results : [];

      if (config.type) {
        items = items.map((item) =>
          typeof item === "object" && item !== null
            ? { ...item, media_type: config.type }
            : item,
        );
      }

      const catTmdbIds = items
        .map(mapTmdbSearchItem)
        .filter((item): item is TmdbSearchItem => Boolean(item))
        .map((i) => i.tmdb_id);
      const catLibEntries = catTmdbIds.length
        ? await prisma.libraryMedia.findMany({
            where: { tmdbId: { in: catTmdbIds } },
            select: { tmdbId: true, id: true },
          })
        : [];
      const catLibMap = new Map(catLibEntries.map((e) => [e.tmdbId, e.id]));

      const enrichedNormalized = items
        .map(mapTmdbSearchItem)
        .filter((item): item is TmdbSearchItem => Boolean(item))
        .map((item) => {
          const libId = catLibMap.get(item.tmdb_id) ?? null;
          return {
            ...item,
            service: "prowlarr" as const,
            already_exists: libId != null,
            can_add: true,
            source_id: null,
            library_id: libId,
          };
        });

      return {
        items: enrichedNormalized,
        page,
        total_pages:
          typeof data.total_pages === "number" ? data.total_pages : 1,
      };
    } catch (error) {
      console.error("Error fetching explore category:", error);
      return serverError(set, "Failed to fetch category");
    }
  })
  .get(
    "/similar/:tmdbId",
    async ({ user, set, params, query: queryParams }) => {
      const tmdbId = parseInt(params.tmdbId, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
        return badRequest(set, "Invalid TMDB ID");
      }

      const typedQuery = queryParams as Record<string, string | undefined>;
      const mediaType = typedQuery.type;
      if (mediaType !== "movie" && mediaType !== "tv") {
        return badRequest(set, "Invalid type, must be movie or tv");
      }

      const language = toTmdbLanguage(typedQuery.language || "en-US");

      try {
        const cacheKey = `medias:recommendations:${mediaType}:${tmdbId}:${language}`;
        const cached = await getJsonCache<TmdbSearchItem[]>(cacheKey);
        if (cached) {
          return { items: cached };
        }

        const tmdbPlugin = await getPluginConfigRecord("tmdb");

        const tmdbConfig = tmdbPlugin?.enabled
          ? normalizeTmdbConfig(tmdbPlugin.config)
          : null;
        if (!tmdbConfig) {
          return badRequest(set, "TMDB is not configured");
        }

        const url = new URL(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/recommendations`,
        );
        url.searchParams.set("api_key", tmdbConfig.api_key);
        url.searchParams.set("language", language);
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        const rawResults: unknown[] = [];
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          if (Array.isArray(data.results)) rawResults.push(...data.results);
        }

        const withType = rawResults.map((item) =>
          typeof item === "object" && item !== null
            ? { ...item, media_type: mediaType }
            : item,
        );

        const baseItems = withType
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .slice(0, 40);

        const simTmdbIds = baseItems.map((i) => i.tmdb_id);
        const simLibEntries = simTmdbIds.length
          ? await prisma.libraryMedia.findMany({
              where: { tmdbId: { in: simTmdbIds } },
              select: { tmdbId: true, id: true },
            })
          : [];
        const simLibMap = new Map(simLibEntries.map((e) => [e.tmdbId, e.id]));
        const enrichedItems = baseItems.map((item) => {
          const libId = simLibMap.get(item.tmdb_id) ?? null;
          return {
            ...item,
            service: "prowlarr" as const,
            already_exists: libId != null,
            can_add: true,
            source_id: null,
            library_id: libId,
          };
        });

        await setJsonCache(cacheKey, enrichedItems, 60 * 60);
        return { items: enrichedItems };
      } catch (error) {
        console.error("Error fetching similar medias:", error);
        return serverError(set, "Failed to fetch similar medias");
      }
    },
    {
      params: t.Object({ tmdbId: t.String() }),
    },
  )
  .get("/streaming-providers", async ({ user, set, query }) => {
    const q = query as Record<string, string | undefined>;
    const region = (q.region || "CA").toUpperCase();
    const type = q.type === "tv" ? "tv" : "movie";
    const language = toTmdbLanguage(q.language || "en-US");
    const cacheKey = `medias:streaming-providers:${region}:${type}:${language}`;

    const cached =
      await getJsonCache<{ id: number; name: string; logo_url: string }[]>(
        cacheKey,
      );
    if (cached) return { providers: cached };

    const tmdbPlugin = await getPluginConfigRecord("tmdb");
    const tmdbConfig = tmdbPlugin?.enabled
      ? normalizeTmdbConfig(tmdbPlugin.config)
      : null;
    if (!tmdbConfig) return { providers: [] };

    try {
      const url = new URL(
        `https://api.themoviedb.org/3/watch/providers/${type}`,
      );
      url.searchParams.set("api_key", tmdbConfig.api_key);
      url.searchParams.set("language", language);
      url.searchParams.set("watch_region", region);
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return { providers: [] };

      const data = (await res.json()) as Record<string, unknown>;
      const LOGO_BASE = "https://image.tmdb.org/t/p/w92";

      const providers = (
        Array.isArray(data.results)
          ? (data.results as Record<string, unknown>[])
          : []
      )
        .map((p) => {
          const id = typeof p.provider_id === "number" ? p.provider_id : null;
          const name = toStringOrNull(p.provider_name);
          const logo = toStringOrNull(p.logo_path);
          if (!id || !name || !logo) return null;
          return { id, name, logo_url: `${LOGO_BASE}${logo}` };
        })
        .filter(
          (p): p is { id: number; name: string; logo_url: string } =>
            p !== null,
        );

      await setJsonCache(cacheKey, providers, 24 * 60 * 60);
      return { providers };
    } catch {
      return { providers: [] };
    }
  })
  .get("/genres", async ({ user, set, query }) => {
    const q = query as Record<string, string | undefined>;
    const type = q.type;
    if (type !== "movie" && type !== "tv") {
      return badRequest(set, "Invalid type, must be movie or tv");
    }

    try {
      const language = toTmdbLanguage(q.language || "en-US");
      const cacheKey = `medias:genres:${type}:${language}`;
      const cached =
        await getJsonCache<{ id: number; name: string }[]>(cacheKey);
      if (cached) return { genres: cached };

      const tmdbPlugin = await getPluginConfigRecord("tmdb");
      const tmdbConfig = tmdbPlugin?.enabled
        ? normalizeTmdbConfig(tmdbPlugin.config)
        : null;
      if (!tmdbConfig) return badRequest(set, "TMDB is not configured");

      const url = new URL(`https://api.themoviedb.org/3/genre/${type}/list`);
      url.searchParams.set("api_key", tmdbConfig.api_key);
      url.searchParams.set("language", language);
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return badGateway(set, "TMDB genres request failed");

      const data = (await res.json()) as Record<string, unknown>;
      const genres = Array.isArray(data.genres)
        ? (data.genres as Record<string, unknown>[])
            .map((g) => ({
              id: typeof g.id === "number" ? g.id : 0,
              name: typeof g.name === "string" ? g.name : "",
            }))
            .filter((g) => g.id > 0 && g.name)
        : [];

      await setJsonCache(cacheKey, genres, 24 * 60 * 60); // 24 hours
      return { genres };
    } catch (error) {
      console.error("Error fetching TMDB genres:", error);
      return serverError(set, "Failed to fetch genres");
    }
  })
  .get("/discover", async ({ user, set, query }) => {
    const q = query as Record<string, string | undefined>;
    const type = q.type;
    if (type !== "movie" && type !== "tv") {
      return badRequest(set, "Invalid type, must be movie or tv");
    }

    const providerId = q.provider_id ? parseInt(q.provider_id, 10) : null;
    const genreId = q.genre_id ? parseInt(q.genre_id, 10) : null;
    const sortBy = q.sort_by || "popularity.desc";
    const page = parseInt(q.page || "1", 10);
    const language = toTmdbLanguage(q.language || "en-US");
    const region = (q.region || "CA").toUpperCase();
    const originalLanguage = q.original_language || null;

    const validSorts = [
      "popularity.desc",
      "popularity.asc",
      "vote_average.desc",
      "vote_average.asc",
      "primary_release_date.desc",
      "first_air_date.desc",
      "revenue.desc",
    ];
    if (!validSorts.includes(sortBy)) {
      return badRequest(set, "Invalid sort_by value");
    }

    // We serve PAGE_SIZE items per logical page. TMDB returns 20 per page, so we
    // fetch the 2–3 TMDB pages that span our logical page window concurrently.
    const PAGE_SIZE = 48;
    const TMDB_PAGE_SIZE = 20;

    const startIdx = (page - 1) * PAGE_SIZE; // 0-indexed first item
    const endIdx = startIdx + PAGE_SIZE - 1; // 0-indexed last item
    const tmdbStartPage = Math.floor(startIdx / TMDB_PAGE_SIZE) + 1;
    const tmdbEndPage = Math.floor(endIdx / TMDB_PAGE_SIZE) + 1;

    try {
      const tmdbPlugin = await getPluginConfigRecord("tmdb");

      const tmdbConfig = tmdbPlugin?.enabled
        ? normalizeTmdbConfig(tmdbPlugin.config)
        : null;
      if (!tmdbConfig) return badRequest(set, "TMDB is not configured");

      const buildUrl = (tmdbPage: number) => {
        const url = new URL(`https://api.themoviedb.org/3/discover/${type}`);
        url.searchParams.set("api_key", tmdbConfig.api_key);
        url.searchParams.set("language", language);
        url.searchParams.set("sort_by", sortBy);
        url.searchParams.set("page", String(tmdbPage));
        url.searchParams.set("include_adult", "false");
        if (providerId) {
          url.searchParams.set("with_watch_providers", String(providerId));
          url.searchParams.set("watch_region", region);
        }
        if (genreId) url.searchParams.set("with_genres", String(genreId));
        if (originalLanguage)
          url.searchParams.set("with_original_language", originalLanguage);
        if (sortBy.startsWith("vote_average"))
          url.searchParams.set("vote_count.gte", "100");
        // When sorting by newest, cap results to already-released content only
        if (sortBy === "primary_release_date.desc") {
          const today = new Date().toISOString().slice(0, 10);
          url.searchParams.set("primary_release_date.lte", today);
        }
        if (sortBy === "first_air_date.desc") {
          const today = new Date().toISOString().slice(0, 10);
          url.searchParams.set("first_air_date.lte", today);
        }
        return url.toString();
      };

      // Fetch all needed TMDB pages concurrently
      const tmdbPageNums = Array.from(
        { length: tmdbEndPage - tmdbStartPage + 1 },
        (_, i) => tmdbStartPage + i,
      );
      const tmdbResponses = await Promise.all(
        tmdbPageNums.map((n) =>
          fetch(buildUrl(n), { headers: { Accept: "application/json" } }),
        ),
      );

      if (tmdbResponses.some((r) => !r.ok))
        return badGateway(set, "TMDB discover request failed");

      const tmdbDatas = await Promise.all(
        tmdbResponses.map((r) => r.json() as Promise<Record<string, unknown>>),
      );

      // Combine results and slice to our logical page window
      const allRaw = tmdbDatas.flatMap((d) =>
        (Array.isArray(d.results) ? d.results : []).map((item) =>
          typeof item === "object" && item !== null
            ? { ...item, media_type: type }
            : item,
        ),
      );
      const offsetWithinBatch = startIdx - (tmdbStartPage - 1) * TMDB_PAGE_SIZE;
      const rawItems = allRaw.slice(
        offsetWithinBatch,
        offsetWithinBatch + PAGE_SIZE,
      );

      // total_results from the first TMDB page (they're all the same)
      const totalResults =
        typeof tmdbDatas[0].total_results === "number"
          ? tmdbDatas[0].total_results
          : 0;
      // TMDB caps at 500 pages of 20 = 10 000 items; our logical total_pages is based on that
      const maxItems = Math.min(totalResults, 500 * TMDB_PAGE_SIZE);
      const totalPages = Math.ceil(maxItems / PAGE_SIZE);

      const baseItems = rawItems
        .map(mapTmdbSearchItem)
        .filter((item): item is TmdbSearchItem => Boolean(item));

      const brseTmdbIds = baseItems.map((i) => i.tmdb_id);
      const brseLibEntries = brseTmdbIds.length
        ? await prisma.libraryMedia.findMany({
            where: { tmdbId: { in: brseTmdbIds } },
            select: { tmdbId: true, id: true },
          })
        : [];
      const brseLibMap = new Map(brseLibEntries.map((e) => [e.tmdbId, e.id]));
      const enrichedBrse = baseItems.map((item) => {
        const libId = brseLibMap.get(item.tmdb_id) ?? null;
        return {
          ...item,
          service: "prowlarr" as const,
          already_exists: libId != null,
          can_add: true,
          source_id: null,
          library_id: libId,
        };
      });

      return {
        items: enrichedBrse,
        page,
        total_pages: totalPages,
        total_results: totalResults,
      };
    } catch (error) {
      console.error("Error fetching TMDB discover:", error);
      return serverError(set, "Failed to fetch discover results");
    }
  })
  .get(
    "/ratings/:mediaType/:tmdbId",
    async ({ set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );
      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig)
        return { imdb_rating: null, rotten_tomatoes: null, metacritic: null };
      return fetchRatings(tmdbConfig.api_key, mediaType, tmdbId, language);
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  )
  .get(
    "/trailer/:mediaType/:tmdbId",
    async ({ set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );
      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig) return { key: null, name: null };
      return fetchTrailer(tmdbConfig.api_key, mediaType, tmdbId, language);
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  )
  .get(
    "/credits/:mediaType/:tmdbId",
    async ({ set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );
      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig) return { cast: [], directors: [] };
      return fetchCredits(tmdbConfig.api_key, mediaType, tmdbId, language);
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  )
  .get(
    "/tmdb-details/:mediaType/:tmdbId",
    async ({ set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );
      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig) return emptyMediaDetails();
      return fetchMediaDetails(tmdbConfig.api_key, mediaType, tmdbId, language);
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  )
  .get(
    "/modal/:mediaType/:tmdbId",
    async ({ user, set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");

      const region =
        (
          queryParams as Record<string, string | undefined>
        ).region?.toUpperCase() || "CA";
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );

      const [tmdbConfig, watchlistItem] = await Promise.all([
        loadTmdbConfig(),
        prisma.watchlistItem.findUnique({
          where: {
            userId_tmdbId_mediaType: { userId: user!.id, tmdbId, mediaType },
          },
          select: { id: true },
        }),
      ]);
      if (!tmdbConfig) return badRequest(set, "TMDB is not configured");

      const [trailer, ratings, credits, details, providers, library_episodes] =
        await Promise.all([
          fetchTrailer(tmdbConfig.api_key, mediaType, tmdbId, language),
          fetchRatings(tmdbConfig.api_key, mediaType, tmdbId, language),
          fetchCredits(tmdbConfig.api_key, mediaType, tmdbId, language),
          fetchMediaDetails(tmdbConfig.api_key, mediaType, tmdbId, language),
          fetchWatchProviders(
            tmdbConfig.api_key,
            mediaType,
            tmdbId,
            region,
            language,
          ),
          (async () => {
            if (mediaType !== "tv") return null;
            const show = await prisma.libraryMedia.findFirst({
              where: { tmdbId, type: "show" },
              select: {
                episodes: {
                  where: { status: "downloaded" },
                  select: { season: true, episode: true },
                },
              },
            });
            if (!show) return { in_library: false, downloaded: [] };
            return {
              in_library: true,
              downloaded: show.episodes.map((e) => ({
                season_number: e.season,
                episode_number: e.episode,
              })),
            };
          })(),
        ]);

      return {
        watchlist_status: watchlistItem !== null,
        watchlist_id: watchlistItem?.id ?? null,
        trailer,
        ratings,
        credits,
        details,
        providers,
        library_episodes,
      };
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  )
  .get(
    "/providers/:mediaType/:tmdbId",
    async ({ set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== "movie" && mediaType !== "tv")
        return badRequest(set, "Invalid media type");
      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0)
        return badRequest(set, "Invalid TMDB ID");
      const region =
        (
          queryParams as Record<string, string | undefined>
        ).region?.toUpperCase() || "CA";
      const language = toTmdbLanguage(
        (queryParams as Record<string, string | undefined>).language || "en-US",
      );
      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig)
        return {
          region,
          streaming: [],
          free: [],
          rent: [],
          buy: [],
          link: null,
        };
      return fetchWatchProviders(
        tmdbConfig.api_key,
        mediaType,
        tmdbId,
        region,
        language,
      );
    },
    { params: t.Object({ mediaType: t.String(), tmdbId: t.String() }) },
  );
