import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeBeszelConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const beszelPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/beszel", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "beszel" },
      });

      const config = normalizeBeszelConfig(plugin?.config);
      const rawConfig =
        plugin?.config &&
        typeof plugin.config === "object" &&
        !Array.isArray(plugin.config)
          ? (plugin.config as Record<string, unknown>)
          : null;

      return {
        plugin: {
          type: "beszel",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          email:
            config?.email ||
            (typeof rawConfig?.email === "string" ? rawConfig.email : ""),
          password_set: Boolean(config?.password),
        },
      };
    } catch (error) {
      console.error("Error fetching Beszel plugin config:", error);
      return serverError(set, "Failed to fetch Beszel plugin config");
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
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: "beszel" },
        });
        const existingConfig = normalizeBeszelConfig(existingPlugin?.config);
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

        const plugin = await prisma.plugin.upsert({
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
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "beszel" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            email,
            password_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving Beszel plugin config:", error);
        return serverError(set, "Failed to save Beszel plugin config");
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
