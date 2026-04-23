import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/integrations/utils";
import { normalizeBeszelConfig } from "@hously/api/utils/integrations/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const beszelIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/beszel", async ({ user, set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "beszel" },
      });

      const config = normalizeBeszelConfig(integration?.config);
      const rawConfig =
        integration?.config &&
        typeof integration.config === "object" &&
        !Array.isArray(integration.config)
          ? (integration.config as Record<string, unknown>)
          : null;

      return {
        integration: {
          type: "beszel",
          enabled: integration?.enabled || false,
          website_url: config?.website_url || "",
          email:
            config?.email ||
            (typeof rawConfig?.email === "string" ? rawConfig.email : ""),
          password_set: Boolean(config?.password),
        },
      };
    } catch (error) {
      console.error("Error fetching Beszel integration config:", error);
      return serverError(set, "Failed to fetch Beszel integration config");
    }
  })
  .put(
    "/beszel",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const email = body.email.trim();
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      if (!email) {
        return badRequest(set, "email is required");
      }

      try {
        const existingIntegration = await prisma.integration.findFirst({
          where: { type: "beszel" },
        });
        const existingConfig = normalizeBeszelConfig(existingIntegration?.config);
        const providedPassword = body.password?.trim() || "";
        const password = providedPassword || existingConfig?.password || "";

        if (!password) {
          return badRequest(set, "password is required");
        }

        const now = nowUtc();
        const config = {
          website_url: websiteUrl,
          email,
          password: encrypt(password),
        };

        const integration = await prisma.integration.upsert({
          where: { type: "beszel" },
          update: { enabled, config, updatedAt: now },
          create: {
            type: "beszel",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "beszel" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            website_url: websiteUrl,
            email,
            password_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving Beszel integration config:", error);
        return serverError(set, "Failed to save Beszel integration config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        email: t.String(),
        password: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
