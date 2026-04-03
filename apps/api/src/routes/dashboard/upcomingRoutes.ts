import { Elysia, t } from "elysia";
import { auth } from "../../auth";
import { requireUser } from "../../middleware/auth";
import {
  TMDB_UPCOMING_CACHE_KEY,
  collectTmdbUpcoming,
  fetchSonarrUpcoming,
  getArrPluginStatus,
  mergeTmdbTvWithSonarrCalendar,
  toIsoDate,
} from "../../utils/dashboard/tmdbUpcoming";
import { prisma } from "../../db";
import { getJsonCache, setJsonCache, deleteCache } from "../../services/cache";
import {
  normalizeRadarrConfig,
  normalizeSonarrConfig,
  normalizeTmdbConfig,
} from "../../utils/plugins/normalizers";
import { toRecord, toStringOrNull } from "@hously/shared";
import type { DashboardUpcomingItem } from "../../types/dashboardUpcoming";
import {
  badGateway,
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "../../utils/errors";

const buildArrItemUrl = (
  baseUrl: string,
  service: "radarr" | "sonarr",
  slug: string,
): string | null => {
  try {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, "");
    const itemPath = service === "radarr" ? "movie" : "series";
    url.pathname = `${basePath}/${itemPath}/${slug}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

export const dashboardUpcomingRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/upcoming", async ({ user, set }) => {
    try {
      const arrPluginStatus = await getArrPluginStatus();
      const tmdbPlugin = await prisma.plugin.findFirst({
        where: { type: "tmdb" },
        select: { enabled: true, config: true },
      });
      const tmdbConfig = tmdbPlugin?.enabled
        ? normalizeTmdbConfig(tmdbPlugin.config)
        : null;
      const tmdbApiKey = tmdbConfig?.api_key ?? null;

      if (!tmdbApiKey) {
        return { enabled: false, items: [], ...arrPluginStatus };
      }

      // Serve from cron-populated cache
      const cached = await getJsonCache<{
        enabled: boolean;
        items: DashboardUpcomingItem[];
      }>(TMDB_UPCOMING_CACHE_KEY);

      if (cached) {
        return { ...cached, ...arrPluginStatus };
      }

      // Cold cache fallback: lightweight fetch without per-movie enrichment or providers
      console.log("[upcoming] Cache miss, running inline fallback");
      const today = new Date();
      const todayIso = toIsoDate(today);
      const oneYearOut = new Date(
        Date.UTC(
          today.getUTCFullYear() + 1,
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      const oneYearOutIso = toIsoDate(oneYearOut);

      const POOL_SIZE_PER_TYPE = 40;
      const [moviesResult, tvResult, sonarrItems] = await Promise.all([
        collectTmdbUpcoming(
          "movie",
          POOL_SIZE_PER_TYPE,
          tmdbApiKey,
          todayIso,
          oneYearOutIso,
        ),
        collectTmdbUpcoming(
          "tv",
          POOL_SIZE_PER_TYPE,
          tmdbApiKey,
          todayIso,
          oneYearOutIso,
        ),
        fetchSonarrUpcoming(todayIso, oneYearOutIso),
      ]);

      if (!moviesResult || !tvResult) {
        return badGateway(set, "TMDB request failed");
      }

      const popularityThreshold = tmdbConfig?.popularity_threshold ?? 15;
      const filteredTv = tvResult.items.filter(
        (item) => (item.popularity ?? 0) >= popularityThreshold,
      );
      const mergedTv = mergeTmdbTvWithSonarrCalendar(filteredTv, sonarrItems);

      const sortedItems = [
        ...moviesResult.items.filter(
          (item) => (item.popularity ?? 0) >= popularityThreshold,
        ),
        ...mergedTv,
      ]
        .filter((item) => {
          if (!item.release_date) return false;
          const releaseTime = Date.parse(item.release_date);
          const todayTime = Date.parse(todayIso);
          const oneYearOutTime = Date.parse(oneYearOutIso);
          return (
            Number.isFinite(releaseTime) &&
            releaseTime >= todayTime &&
            releaseTime <= oneYearOutTime
          );
        })
        .sort((a, b) => {
          const aTime = a.release_date
            ? Date.parse(a.release_date)
            : Number.POSITIVE_INFINITY;
          const bTime = b.release_date
            ? Date.parse(b.release_date)
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        });

      // Strip popularity before caching
      const cleanItems: DashboardUpcomingItem[] = sortedItems.map(
        ({ popularity: _, ...rest }) => rest,
      );

      // Cache with a shorter TTL so the cron job overwrites it soon
      const responsePayload = { enabled: true, items: cleanItems };
      await setJsonCache(TMDB_UPCOMING_CACHE_KEY, responsePayload, 60 * 60);
      return { ...responsePayload, ...arrPluginStatus };
    } catch (error) {
      console.error("Error getting TMDB upcoming items:", error);
      return serverError(set, "Failed to get TMDB upcoming items");
    }
  })
  .post(
    "/upcoming/add",
    async ({ user, body, set }) => {
      const { media_type: mediaType, tmdb_id: tmdbId } = body;
      const searchOnAdd = body.search_on_add ?? true;

      try {
        if (mediaType === "movie") {
          const radarrPlugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });

          if (!radarrPlugin?.enabled) {
            return badRequest(set, "Radarr plugin is not enabled");
          }

          const config = normalizeRadarrConfig(radarrPlugin.config);
          if (!config) {
            return badRequest(set, "Radarr plugin is not configured");
          }

          const lookupUrl = new URL(
            "/api/v3/movie/lookup/tmdb",
            config.website_url,
          );
          lookupUrl.searchParams.set("tmdbId", String(tmdbId));
          const lookupResponse = await fetch(lookupUrl.toString(), {
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
          });

          if (!lookupResponse.ok) {
            return badGateway(set, "Radarr lookup failed");
          }

          const lookupData = (await lookupResponse.json()) as
            | Record<string, unknown>
            | Record<string, unknown>[];
          const movieRecord = Array.isArray(lookupData)
            ? lookupData[0]
            : lookupData;
          const movie = toRecord(movieRecord);
          if (!movie) {
            return notFound(set, "Movie not found in Radarr lookup");
          }

          const payload = {
            ...movie,
            qualityProfileId: config.quality_profile_id,
            rootFolderPath: config.root_folder_path,
            monitored: true,
            addOptions: {
              searchForMovie: searchOnAdd,
            },
          };

          const addUrl = new URL("/api/v3/movie", config.website_url);
          const addResponse = await fetch(addUrl.toString(), {
            method: "POST",
            headers: {
              "X-Api-Key": config.api_key,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (addResponse.status === 409) {
            return {
              success: true,
              service: "radarr",
              added: false,
              already_exists: true,
            };
          }

          if (!addResponse.ok) {
            const debugText = await addResponse.text().catch(() => null);
            // Radarr returns 400 with MovieExistsValidator when the movie is already added
            if (
              addResponse.status === 400 &&
              debugText &&
              debugText.includes("MovieExistsValidator")
            ) {
              return {
                success: true,
                service: "radarr",
                added: false,
                already_exists: true,
              };
            }
            console.error("Failed to add movie to Radarr", {
              status: addResponse.status,
              tmdbId,
              payload:
                (payload as any).title || (payload as any).tmdbId || payload,
              body: debugText,
            });
            return badGateway(set, "Failed to add movie to Radarr");
          }

          await deleteCache("medias:radarr:ids");

          return {
            success: true,
            service: "radarr",
            added: true,
            already_exists: false,
          };
        }

        const sonarrPlugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });

        if (!sonarrPlugin?.enabled) {
          return badRequest(set, "Sonarr plugin is not enabled");
        }

        const config = normalizeSonarrConfig(sonarrPlugin.config);
        if (!config) {
          return badRequest(set, "Sonarr plugin is not configured");
        }

        const lookupUrl = new URL("/api/v3/series/lookup", config.website_url);
        lookupUrl.searchParams.set("term", `tmdb:${tmdbId}`);
        const lookupResponse = await fetch(lookupUrl.toString(), {
          headers: { "X-Api-Key": config.api_key, Accept: "application/json" },
        });

        if (!lookupResponse.ok) {
          return badGateway(set, "Sonarr lookup failed");
        }

        const lookupData = (await lookupResponse.json()) as unknown[];
        const firstMatch = Array.isArray(lookupData)
          ? toRecord(lookupData[0])
          : null;
        if (!firstMatch) {
          return notFound(set, "Series not found in Sonarr lookup");
        }

        const payload = {
          ...firstMatch,
          qualityProfileId: config.quality_profile_id,
          languageProfileId: config.language_profile_id,
          rootFolderPath: config.root_folder_path,
          monitored: true,
          addOptions: {
            searchForMissingEpisodes: searchOnAdd,
          },
        };

        const addUrl = new URL("/api/v3/series", config.website_url);
        const addResponse = await fetch(addUrl.toString(), {
          method: "POST",
          headers: {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (addResponse.status === 409) {
          return {
            success: true,
            service: "sonarr",
            added: false,
            already_exists: true,
          };
        }

        if (!addResponse.ok) {
          return badGateway(set, "Failed to add series to Sonarr");
        }

        await deleteCache("medias:sonarr:ids");

        return {
          success: true,
          service: "sonarr",
          added: true,
          already_exists: false,
        };
      } catch (error) {
        console.error("Error adding upcoming item to *arr:", error);
        return serverError(set, "Failed to add upcoming item");
      }
    },
    {
      body: t.Object({
        media_type: t.Union([t.Literal("movie"), t.Literal("tv")]),
        tmdb_id: t.Numeric(),
        search_on_add: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/upcoming/status",
    async ({ user, body, set }) => {
      const { media_type: mediaType, tmdb_id: tmdbId } = body;

      try {
        if (mediaType === "movie") {
          const radarrPlugin = await prisma.plugin.findFirst({
            where: { type: "radarr" },
            select: { enabled: true, config: true },
          });

          if (!radarrPlugin?.enabled) {
            return {
              exists: false,
              service: "radarr",
              can_add: false,
              source_id: null,
              arr_url: null,
            };
          }

          const config = normalizeRadarrConfig(radarrPlugin.config);
          if (!config) {
            return {
              exists: false,
              service: "radarr",
              can_add: false,
              source_id: null,
              arr_url: null,
            };
          }

          const movieUrl = new URL("/api/v3/movie", config.website_url);
          movieUrl.searchParams.set("tmdbId", String(tmdbId));
          const movieResponse = await fetch(movieUrl.toString(), {
            headers: {
              "X-Api-Key": config.api_key,
              Accept: "application/json",
            },
          });

          if (!movieResponse.ok) {
            return badGateway(set, "Radarr movie lookup failed");
          }

          const movieData = (await movieResponse.json()) as unknown[];
          const firstMovie = Array.isArray(movieData)
            ? toRecord(movieData[0])
            : null;
          const sourceId =
            firstMovie && typeof firstMovie.id === "number"
              ? Math.trunc(firstMovie.id)
              : null;
          const exists = Array.isArray(movieData) && movieData.length > 0;

          return {
            exists,
            service: "radarr",
            can_add: true,
            source_id: sourceId,
            arr_url: exists
              ? buildArrItemUrl(config.website_url, "radarr", String(tmdbId))
              : null,
          };
        }

        const sonarrPlugin = await prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        });

        if (!sonarrPlugin?.enabled) {
          return {
            exists: false,
            service: "sonarr",
            can_add: false,
            source_id: null,
            arr_url: null,
          };
        }

        const config = normalizeSonarrConfig(sonarrPlugin.config);
        if (!config) {
          return {
            exists: false,
            service: "sonarr",
            can_add: false,
            source_id: null,
            arr_url: null,
          };
        }

        const seriesUrl = new URL("/api/v3/series", config.website_url);
        seriesUrl.searchParams.set("tmdbId", String(tmdbId));
        const seriesResponse = await fetch(seriesUrl.toString(), {
          headers: { "X-Api-Key": config.api_key, Accept: "application/json" },
        });

        if (!seriesResponse.ok) {
          return badGateway(set, "Sonarr series lookup failed");
        }

        const seriesData = (await seriesResponse.json()) as unknown[];
        const firstSeries = Array.isArray(seriesData)
          ? toRecord(seriesData[0])
          : null;
        const sourceId =
          firstSeries && typeof firstSeries.id === "number"
            ? Math.trunc(firstSeries.id)
            : null;
        const titleSlug = firstSeries
          ? toStringOrNull(firstSeries.titleSlug)
          : null;
        const exists = Array.isArray(seriesData) && seriesData.length > 0;

        return {
          exists,
          service: "sonarr",
          can_add: true,
          source_id: sourceId,
          arr_url:
            exists && titleSlug
              ? buildArrItemUrl(config.website_url, "sonarr", titleSlug)
              : null,
        };
      } catch (error) {
        console.error("Error checking upcoming item status", error);
        return serverError(set, "Failed to check upcoming item status");
      }
    },
    {
      body: t.Object({
        media_type: t.Union([t.Literal("movie"), t.Literal("tv")]),
        tmdb_id: t.Numeric(),
      }),
    },
  );
