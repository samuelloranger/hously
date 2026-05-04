import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireAdmin } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import { normalizeJellyfinSyncConfig } from "@hously/api/utils/integrations/normalizers";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

export function resolveSyncUser(
  jellyfinUserId: string,
  mappings: JellyfinUserMapping[],
): number | null {
  return (
    mappings.find((m) => m.jellyfin_user_id === jellyfinUserId)
      ?.hously_user_id ?? null
  );
}

export function validateSyncToken(
  authHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === expectedToken;
}

const syncTokenMiddleware = new Elysia().derive(
  { as: "scoped" },
  async ({ headers, set }) => {
    const integration = await getIntegrationConfigRecord("jellyfin");
    const syncConfig = normalizeJellyfinSyncConfig(integration?.config);

    if (
      !syncConfig ||
      !validateSyncToken(headers["authorization"], syncConfig.sync_token)
    ) {
      set.status = 401;
      throw new Error("Unauthorized");
    }

    return { syncConfig };
  },
);

const pluginRoutes = new Elysia()
  .use(syncTokenMiddleware)

  // GET /api/sync/jellyfin/watchlist/:jellyfinUserId
  .get("/watchlist/:jellyfinUserId", async ({ params, syncConfig, set }) => {
    const houslyUserId = resolveSyncUser(
      params.jellyfinUserId,
      syncConfig.user_mappings,
    );
    if (!houslyUserId) return badRequest(set, "Unknown Jellyfin user");

    try {
      const items = await prisma.watchlistItem.findMany({
        where: { userId: houslyUserId },
        select: {
          tmdbId: true,
          mediaType: true,
          title: true,
        },
      });
      return {
        items: items.map((i) => ({
          tmdb_id: i.tmdbId,
          media_type: i.mediaType,
          title: i.title,
        })),
      };
    } catch {
      return serverError(set, "Failed to fetch watchlist");
    }
  })

  // DELETE /api/sync/jellyfin/watchlist/:jellyfinUserId/item/:tmdbId?type=movie|tv
  .delete(
    "/watchlist/:jellyfinUserId/item/:tmdbId",
    async ({ params, query, syncConfig, set }) => {
      const houslyUserId = resolveSyncUser(
        params.jellyfinUserId,
        syncConfig.user_mappings,
      );
      if (!houslyUserId) return badRequest(set, "Unknown Jellyfin user");

      const tmdbId = parseInt(params.tmdbId, 10);
      if (isNaN(tmdbId)) return badRequest(set, "Invalid tmdbId");
      if (!query.type) return badRequest(set, "Missing type query param");

      try {
        await prisma.watchlistItem.deleteMany({
          where: { userId: houslyUserId, tmdbId, mediaType: query.type },
        });
        return { success: true };
      } catch {
        return serverError(set, "Failed to remove from watchlist");
      }
    },
    { query: t.Object({ type: t.Optional(t.String()) }) },
  );

const adminRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)

  // POST /api/sync/jellyfin/trigger — push sync to Jellyfin plugin
  .post(
    "/trigger",
    async ({ body, set }) => {
      const integration = await getIntegrationConfigRecord("jellyfin");
      const syncConfig = normalizeJellyfinSyncConfig(integration?.config);

      if (!syncConfig?.website_url || !syncConfig.sync_token) {
        return badRequest(set, "Jellyfin sync not configured");
      }

      try {
        await fetch(`${syncConfig.website_url}/hously/webhook/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${syncConfig.sync_token}`,
          },
          body: JSON.stringify({
            jellyfin_user_id: body?.jellyfin_user_id ?? null,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        return { success: true };
      } catch (e) {
        console.error("[jellyfinSyncTrigger] Failed to push sync:", e);
        return serverError(set, "Failed to reach Jellyfin plugin");
      }
    },
    {
      body: t.Optional(
        t.Object({
          jellyfin_user_id: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      ),
    },
  );

export const jellyfinSyncRoutes = new Elysia({ prefix: "/api/sync/jellyfin" })
  .use(pluginRoutes)
  .use(adminRoutes);
