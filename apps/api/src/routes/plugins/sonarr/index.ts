import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import {
  isValidHttpUrl,
  normalizeUrl,
  toProfiles,
} from "@hously/api/utils/plugins/utils";
import { normalizeSonarrConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badGateway, badRequest, serverError } from "@hously/api/errors";

export const sonarrPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/sonarr", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "sonarr" },
      });

      const config = normalizeSonarrConfig(plugin?.config);
      return {
        plugin: {
          type: "sonarr",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
          root_folder_path: config?.root_folder_path || "",
          quality_profile_id: config?.quality_profile_id || 1,
          language_profile_id: config?.language_profile_id || 1,
        },
      };
    } catch (error) {
      console.error("Error fetching Sonarr plugin config:", error);
      return serverError(set, "Failed to fetch Sonarr plugin config");
    }
  })
  .put(
    "/sonarr",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "sonarr" },
      });
      const existingConfig = normalizeSonarrConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const rootFolderPath = body.root_folder_path.trim();
      const qualityProfileId = Math.trunc(body.quality_profile_id);
      const languageProfileId = Math.trunc(body.language_profile_id);
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

      if (!Number.isFinite(languageProfileId) || languageProfileId <= 0) {
        return badRequest(
          set,
          "language_profile_id must be a positive integer",
        );
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "sonarr" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
              language_profile_id: languageProfileId,
            },
            updatedAt: now,
          },
          create: {
            type: "sonarr",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
              language_profile_id: languageProfileId,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "sonarr" },
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
            language_profile_id: languageProfileId,
          },
        };
      } catch (error) {
        console.error("Error saving Sonarr plugin config:", error);
        return serverError(set, "Failed to save Sonarr plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        root_folder_path: t.String(),
        quality_profile_id: t.Numeric(),
        language_profile_id: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/sonarr/profiles",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const apiKey = body.api_key.trim();

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "sonarr" },
      });
      const existingConfig = normalizeSonarrConfig(existingPlugin?.config);
      const resolvedApiKey = apiKey || existingConfig?.api_key || "";

      if (!resolvedApiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const qualityUrl = new URL("/api/v3/qualityprofile", websiteUrl);
        const languageUrl = new URL("/api/v3/languageprofile", websiteUrl);

        const [qualityResponse, languageResponse] = await Promise.all([
          fetch(qualityUrl.toString(), {
            headers: {
              "X-Api-Key": resolvedApiKey,
              Accept: "application/json",
            },
          }),
          fetch(languageUrl.toString(), {
            headers: {
              "X-Api-Key": resolvedApiKey,
              Accept: "application/json",
            },
          }),
        ]);

        if (!qualityResponse.ok || !languageResponse.ok) {
          return badGateway(set, "Failed to fetch Sonarr profiles");
        }

        const [qualityPayload, languagePayload] = (await Promise.all([
          qualityResponse.json(),
          languageResponse.json(),
        ])) as [unknown, unknown];

        return {
          quality_profiles: toProfiles(qualityPayload),
          language_profiles: toProfiles(languagePayload),
        };
      } catch (error) {
        console.error("Error fetching Sonarr profiles:", error);
        return serverError(set, "Failed to fetch Sonarr profiles");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
      }),
    },
  );
