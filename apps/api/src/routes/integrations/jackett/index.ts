import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import {
  isValidHttpUrl,
  normalizeUrl,
} from "@hously/api/utils/integrations/utils";
import { normalizeJackettConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import { JackettAdapter } from "@hously/api/services/indexerManager/jackettAdapter";

export const jackettIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/jackett", async ({ set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "jackett" },
      });

      const config = normalizeJackettConfig(integration?.config);
      return {
        integration: {
          type: "jackett",
          enabled: integration?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
          rss_indexers: config?.rss_indexers ?? [],
        },
      };
    } catch (error) {
      console.error("Error fetching Jackett integration config:", error);
      return serverError(set, "Failed to fetch Jackett integration config");
    }
  })
  .put(
    "/jackett",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const existingIntegration = await prisma.integration.findFirst({
        where: { type: "jackett" },
      });
      const existingConfig = normalizeJackettConfig(
        existingIntegration?.config,
      );
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
        const rssIndexers = Array.isArray(body.rss_indexers)
          ? body.rss_indexers
          : (existingConfig?.rss_indexers ?? []);

        const integration = await prisma.integration.upsert({
          where: { type: "jackett" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              rss_indexers: rssIndexers,
            },
            updatedAt: now,
          },
          create: {
            type: "jackett",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              rss_indexers: rssIndexers,
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
          const prowlarr = await prisma.integration.findFirst({
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
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "jackett" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            website_url: websiteUrl,
            api_key: "",
          },
        };
      } catch (error) {
        console.error("Error saving Jackett integration config:", error);
        return serverError(set, "Failed to save Jackett integration config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
        rss_indexers: t.Optional(t.Array(t.String({ minLength: 1 }))),
      }),
    },
  )
  .get("/jackett/indexers", async ({ set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "jackett", enabled: true },
      });
      const config = normalizeJackettConfig(integration?.config);
      if (!config) return { indexers: [] };
      const adapter = new JackettAdapter(config);
      const indexers = await adapter.getIndexers();
      return { indexers };
    } catch (error) {
      console.error("Error fetching Jackett indexers:", error);
      return serverError(set, "Failed to fetch Jackett indexers");
    }
  });
