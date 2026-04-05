import { Elysia, t } from "elysia";
import { auth } from "../../../auth";
import { prisma } from "../../../db";
import { nowUtc } from "../../../utils";
import { normalizeTmdbConfig } from "../../../utils/plugins/normalizers";
import { encrypt } from "../../../services/crypto";
import { logActivity } from "../../../utils/activityLogs";
import { requireAdmin } from "../../../middleware/auth";
import { badRequest, serverError } from "../../../errors";

export const tmdbPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/tmdb", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "tmdb" },
      });
      const config = normalizeTmdbConfig(plugin?.config);

      return {
        plugin: {
          type: "tmdb",
          enabled: plugin?.enabled || false,
          api_key: "",
          popularity_threshold: config?.popularity_threshold ?? 15,
        },
      };
    } catch (error) {
      console.error("Error fetching TMDB plugin config:", error);
      return serverError(set, "Failed to fetch TMDB plugin config");
    }
  })
  .put(
    "/tmdb",
    async ({ user, body, set }) => {
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "tmdb" },
      });
      const existingConfig = normalizeTmdbConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const enabled = body.enabled ?? true;
      const popularityThreshold = Math.max(
        0,
        Math.min(100, Math.round(body.popularity_threshold ?? 15)),
      );

      if (!apiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const now = nowUtc();
        const configPayload = {
          api_key: encrypt(apiKey),
          popularity_threshold: popularityThreshold,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: "tmdb" },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: "tmdb",
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "tmdb" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            api_key: "",
            popularity_threshold: popularityThreshold,
          },
        };
      } catch (error) {
        console.error("Error saving TMDB plugin config:", error);
        return serverError(set, "Failed to save TMDB plugin config");
      }
    },
    {
      body: t.Object({
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
        popularity_threshold: t.Optional(t.Number()),
      }),
    },
  );
