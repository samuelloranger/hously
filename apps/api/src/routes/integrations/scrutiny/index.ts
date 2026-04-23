import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/integrations/utils";
import { normalizeScrutinyConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const scrutinyIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/scrutiny", async ({ user, set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "scrutiny" },
      });

      const config = normalizeScrutinyConfig(integration?.config);
      return {
        integration: {
          type: "scrutiny",
          enabled: integration?.enabled || false,
          website_url: config?.website_url || "",
        },
      };
    } catch (error) {
      console.error("Error fetching Scrutiny integration config:", error);
      return serverError(set, "Failed to fetch Scrutiny integration config");
    }
  })
  .put(
    "/scrutiny",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
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
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "scrutiny" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            website_url: websiteUrl,
          },
        };
      } catch (error) {
        console.error("Error saving Scrutiny integration config:", error);
        return serverError(set, "Failed to save Scrutiny integration config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
