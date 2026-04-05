import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { getJsonCache } from "@hously/api/services/cache";
import { normalizeTrackerConfig } from "@hously/api/utils/plugins/normalizers";
import type { CachedTrackerStats } from "@hously/api/utils/dashboard/trackers";
import {
  cacheKey,
  parseCachedTrackerStats,
} from "@hously/api/utils/dashboard/trackers";
import type { TrackerType } from "@hously/api/utils/plugins/types";
import { serverError } from "@hously/api/errors";

const trackerLabel = (type: TrackerType): string => {
  return {
    c411: "C411",
    torr9: "Torr9",
    "la-cale": "La Cale",
  }[type];
};

async function getTrackerStatsHandler(type: TrackerType) {
  // Check Redis first. Stats are cached for 24 h, so if we have a cache hit the
  // plugin is enabled by definition — no DB query needed on every dashboard load.
  const cached = await getJsonCache<CachedTrackerStats>(cacheKey(type));
  const parsed = parseCachedTrackerStats(cached);
  if (parsed) {
    return { enabled: true, connected: true, ...parsed };
  }

  // Cache miss — fall back to DB to determine plugin state.
  const plugin = await prisma.plugin.findFirst({ where: { type } });
  const enabled = Boolean(plugin?.enabled);

  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      updated_at: null,
      uploaded_go: null,
      downloaded_go: null,
      ratio: null,
    };
  }

  const config = normalizeTrackerConfig(plugin?.config);
  if (!config) {
    return {
      enabled: true,
      connected: false,
      updated_at: null,
      uploaded_go: null,
      downloaded_go: null,
      ratio: null,
      error: `${trackerLabel(type)} plugin is not configured`,
    };
  }

  return {
    enabled: true,
    connected: false,
    updated_at: null,
    uploaded_go: null,
    downloaded_go: null,
    ratio: null,
    error: `${trackerLabel(type)} stats have not been fetched yet`,
  };
}

const TRACKER_TYPES: TrackerType[] = ["c411", "torr9", "la-cale"];

async function getAllTrackerStatsHandler() {
  const results = await Promise.all(
    TRACKER_TYPES.map(async (type) => {
      try {
        return [type, await getTrackerStatsHandler(type)] as const;
      } catch (error) {
        console.error(`Error fetching ${trackerLabel(type)} stats:`, error);
        return [
          type,
          {
            enabled: false,
            connected: false,
            updated_at: null,
            uploaded_go: null,
            downloaded_go: null,
            ratio: null,
            error: `Failed to get ${trackerLabel(type)} stats`,
          },
        ] as const;
      }
    }),
  );

  return Object.fromEntries(results);
}

export const dashboardTrackersRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/trackers/stats", async ({ user, set }) => {
    try {
      return await getAllTrackerStatsHandler();
    } catch (error) {
      console.error("Error fetching trackers stats:", error);
      return serverError(set, "Failed to get trackers stats");
    }
  })
  .get("/c411/stats", async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler("c411");
    } catch (error) {
      console.error("Error fetching C411 stats:", error);
      return serverError(set, "Failed to get C411 stats");
    }
  })
  .get("/torr9/stats", async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler("torr9");
    } catch (error) {
      console.error("Error fetching Torr9 stats:", error);
      return serverError(set, "Failed to get Torr9 stats");
    }
  })
  .get("/la-cale/stats", async ({ user, set }) => {
    try {
      return await getTrackerStatsHandler("la-cale");
    } catch (error) {
      console.error("Error fetching La Cale stats:", error);
      return serverError(set, "Failed to get La Cale stats");
    }
  });
