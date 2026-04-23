import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import {
  TMDB_UPCOMING_CACHE_KEY,
  collectTmdbUpcoming,
  getTmdbUpcomingDateWindowIso,
} from "@hously/api/utils/dashboard/tmdbUpcoming";
import {
  collectLibraryUpcoming,
  mergeUpcomingById,
} from "@hously/api/utils/dashboard/libraryUpcoming";
import { prisma } from "@hously/api/db";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { getJsonCache, setJsonCache } from "@hously/api/services/cache";
import { normalizeTmdbConfig } from "@hously/api/utils/integrations/normalizers";
import type { DashboardUpcomingItem } from "@hously/api/types/dashboardUpcoming";
import { badGateway, badRequest, serverError } from "@hously/api/errors";
import { addOrUpdateLibraryFromTmdb } from "@hously/api/services/libraryFromTmdb";

export const dashboardUpcomingRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/upcoming", async ({ set }) => {
    try {
      const tmdbIntegration = await getIntegrationConfigRecord("tmdb");
      const tmdbConfig = tmdbIntegration?.enabled
        ? normalizeTmdbConfig(tmdbIntegration.config)
        : null;
      const tmdbApiKey = tmdbConfig?.api_key ?? null;

      if (!tmdbApiKey) {
        return { enabled: false, items: [] };
      }

      const cached = await getJsonCache<{
        enabled: boolean;
        items: DashboardUpcomingItem[];
      }>(TMDB_UPCOMING_CACHE_KEY);

      if (cached) {
        return cached;
      }

      console.log("[upcoming] Cache miss, running inline fallback");
      const { todayIso, oneYearOutIso } = getTmdbUpcomingDateWindowIso();

      const POOL_SIZE_PER_TYPE = 40;
      const [moviesResult, tvResult] = await Promise.all([
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
      ]);

      if (!moviesResult || !tvResult) {
        return badGateway(set, "TMDB request failed");
      }

      const popularityThreshold = tmdbConfig?.popularity_threshold ?? 15;
      const filteredTv = tvResult.items.filter(
        (item) => (item.popularity ?? 0) >= popularityThreshold,
      );

      const libraryItems = await collectLibraryUpcoming(
        todayIso,
        oneYearOutIso,
      );

      const sortedItems = mergeUpcomingById(
        [
          ...moviesResult.items.filter(
            (item) => (item.popularity ?? 0) >= popularityThreshold,
          ),
          ...filteredTv,
        ],
        libraryItems,
      )
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

      const cleanItems: DashboardUpcomingItem[] = sortedItems.map(
        ({ popularity: _, ...rest }) => rest,
      );

      const responsePayload = { enabled: true, items: cleanItems };
      await setJsonCache(TMDB_UPCOMING_CACHE_KEY, responsePayload, 60 * 60);
      return responsePayload;
    } catch (error) {
      console.error("Error getting TMDB upcoming items:", error);
      return serverError(set, "Failed to get TMDB upcoming items");
    }
  })
  .post(
    "/upcoming/add",
    async ({ body, set }) => {
      const { media_type: mediaType, tmdb_id: tmdbId } = body;

      try {
        const existing = await prisma.libraryMedia.findUnique({
          where: { tmdbId: tmdbId },
        });
        if (existing) {
          return {
            success: true,
            added: false,
            already_exists: true,
          };
        }

        const libType = mediaType === "movie" ? "movie" : "show";
        await addOrUpdateLibraryFromTmdb({
          tmdb_id: tmdbId,
          type: libType,
        });

        return {
          success: true,
          added: true,
          already_exists: false,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "TMDB is not configured") {
          return badRequest(set, msg);
        }
        console.error("Error adding upcoming item to library:", error);
        return serverError(set, "Failed to add upcoming item");
      }
    },
    {
      body: t.Object({
        media_type: t.Union([t.Literal("movie"), t.Literal("tv")]),
        tmdb_id: t.Numeric(),
      }),
    },
  )
  .post(
    "/upcoming/status",
    async ({ body, set }) => {
      const { tmdb_id: tmdbId } = body;

      try {
        const row = await prisma.libraryMedia.findUnique({
          where: { tmdbId },
          select: { id: true },
        });

        return {
          exists: Boolean(row),
          library_id: row?.id ?? null,
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
