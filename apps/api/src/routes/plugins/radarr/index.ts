import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, toProfiles } from "@hously/api/utils/plugins/utils";
import { normalizeRadarrConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badGateway, badRequest, serverError } from "@hously/api/errors";

export const radarrPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/radarr", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "radarr" },
      });

      const config = normalizeRadarrConfig(plugin?.config);
      return {
        plugin: {
          type: "radarr",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
          root_folder_path: config?.root_folder_path || "",
          quality_profile_id: config?.quality_profile_id || 1,
        },
      };
    } catch (error) {
      console.error("Error fetching Radarr plugin config:", error);
      return serverError(set, "Failed to fetch Radarr plugin config");
    }
  })
  .put(
    "/radarr",
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "radarr" },
      });
      const existingConfig = normalizeRadarrConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const rootFolderPath = body.root_folder_path.trim();
      const qualityProfileId = Math.trunc(body.quality_profile_id);
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

      if (!rootFolderPath) {
        return badRequest(set, "root_folder_path is required");
      }

      if (!Number.isFinite(qualityProfileId) || qualityProfileId <= 0) {
        return badRequest(set, "quality_profile_id must be a positive integer");
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "radarr" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
            },
            updatedAt: now,
          },
          create: {
            type: "radarr",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "radarr" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: "",
            root_folder_path: rootFolderPath,
            quality_profile_id: qualityProfileId,
          },
        };
      } catch (error) {
        console.error("Error saving Radarr plugin config:", error);
        return serverError(set, "Failed to save Radarr plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        root_folder_path: t.String(),
        quality_profile_id: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/radarr/profiles",
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
      const apiKey = body.api_key.trim();

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "radarr" },
      });
      const existingConfig = normalizeRadarrConfig(existingPlugin?.config);
      const resolvedApiKey = apiKey || existingConfig?.api_key || "";

      if (!resolvedApiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const qualityUrl = new URL("/api/v3/qualityprofile", websiteUrl);
        const qualityResponse = await fetch(qualityUrl.toString(), {
          headers: { "X-Api-Key": resolvedApiKey, Accept: "application/json" },
        });

        if (!qualityResponse.ok) {
          return badGateway(set, "Failed to fetch Radarr quality profiles");
        }

        const qualityPayload = (await qualityResponse.json()) as unknown;
        return {
          quality_profiles: toProfiles(qualityPayload),
        };
      } catch (error) {
        console.error("Error fetching Radarr profiles:", error);
        return serverError(set, "Failed to fetch Radarr profiles");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
      }),
    },
  );
