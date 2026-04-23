import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/integrations/utils";
import { normalizeJellyfinConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const jellyfinIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/jellyfin", async ({ user, set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "jellyfin" },
      });

      const config = normalizeJellyfinConfig(integration?.config);
      return {
        integration: {
          type: "jellyfin",
          enabled: integration?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
        },
      };
    } catch (error) {
      console.error("Error fetching Jellyfin integration config:", error);
      return serverError(set, "Failed to fetch Jellyfin integration config");
    }
  })
  .put(
    "/jellyfin",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const existingIntegration = await prisma.integration.findFirst({
        where: { type: "jellyfin" },
      });
      const existingConfig = normalizeJellyfinConfig(existingIntegration?.config);
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
        const integration = await prisma.integration.upsert({
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
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "jellyfin" },
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
        console.error("Error saving Jellyfin integration config:", error);
        return serverError(set, "Failed to save Jellyfin integration config");
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
