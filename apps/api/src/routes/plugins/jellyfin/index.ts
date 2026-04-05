import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl } from "@hously/api/utils/plugins/utils";
import { normalizeJellyfinConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const jellyfinPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/jellyfin", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "jellyfin" },
      });

      const config = normalizeJellyfinConfig(plugin?.config);
      return {
        plugin: {
          type: "jellyfin",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
        },
      };
    } catch (error) {
      console.error("Error fetching Jellyfin plugin config:", error);
      return serverError(set, "Failed to fetch Jellyfin plugin config");
    }
  })
  .put(
    "/jellyfin",
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "jellyfin" },
      });
      const existingConfig = normalizeJellyfinConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      if (!apiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "jellyfin" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            updatedAt: now,
          },
          create: {
            type: "jellyfin",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "jellyfin" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: "",
          },
        };
      } catch (error) {
        console.error("Error saving Jellyfin plugin config:", error);
        return serverError(set, "Failed to save Jellyfin plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
