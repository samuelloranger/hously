import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeJackettConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const jackettPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/jackett", async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "jackett" },
      });

      const config = normalizeJackettConfig(plugin?.config);
      return {
        plugin: {
          type: "jackett",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
        },
      };
    } catch (error) {
      console.error("Error fetching Jackett plugin config:", error);
      return serverError(set, "Failed to fetch Jackett plugin config");
    }
  })
  .put(
    "/jackett",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "jackett" },
      });
      const existingConfig = normalizeJackettConfig(existingPlugin?.config);
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
          where: { type: "jackett" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            updatedAt: now,
          },
          create: {
            type: "jackett",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        const settings = await prisma.mediaSettings.findUnique({
          where: { id: 1 },
        });
        if (enabled && !settings?.activeIndexerManager) {
          await prisma.mediaSettings.upsert({
            where: { id: 1 },
            update: { activeIndexerManager: "jackett" },
            create: { id: 1, activeIndexerManager: "jackett" },
          });
        }

        if (!enabled && settings?.activeIndexerManager === "jackett") {
          const prowlarr = await prisma.plugin.findFirst({
            where: { type: "prowlarr", enabled: true },
          });
          await prisma.mediaSettings.update({
            where: { id: 1 },
            data: {
              activeIndexerManager: prowlarr ? "prowlarr" : null,
            },
          });
        }

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "jackett" },
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
        console.error("Error saving Jackett plugin config:", error);
        return serverError(set, "Failed to save Jackett plugin config");
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
