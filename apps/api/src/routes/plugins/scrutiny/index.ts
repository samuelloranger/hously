import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl } from "@hously/api/utils/plugins/utils";
import { normalizeScrutinyConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const scrutinyPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/scrutiny", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "scrutiny" },
      });

      const config = normalizeScrutinyConfig(plugin?.config);
      return {
        plugin: {
          type: "scrutiny",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
        },
      };
    } catch (error) {
      console.error("Error fetching Scrutiny plugin config:", error);
      return serverError(set, "Failed to fetch Scrutiny plugin config");
    }
  })
  .put(
    "/scrutiny",
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "scrutiny" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
            },
            updatedAt: now,
          },
          create: {
            type: "scrutiny",
            enabled,
            config: {
              website_url: websiteUrl,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "scrutiny" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
          },
        };
      } catch (error) {
        console.error("Error saving Scrutiny plugin config:", error);
        return serverError(set, "Failed to save Scrutiny plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
