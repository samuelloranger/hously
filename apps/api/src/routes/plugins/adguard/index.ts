import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getPluginConfigRecord,
  invalidatePluginConfigCache,
} from "@hously/api/services/pluginConfigCache";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeAdguardConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badGateway, badRequest, serverError } from "@hously/api/errors";

const toBoolean = (value: unknown): boolean => value === true;

type AdguardApiConfig = {
  website_url: string;
  username: string;
  password: string;
};

async function getAdguardApiConfig(set: {
  status?: number | string;
}): Promise<{ config?: AdguardApiConfig; error?: string }> {
  const plugin = await getPluginConfigRecord("adguard");

  if (!plugin?.enabled) {
    return badRequest(set, "AdGuard Home plugin is not enabled");
  }

  const config = normalizeAdguardConfig(plugin.config);
  if (!config) {
    return badRequest(set, "AdGuard Home plugin is not configured");
  }

  return { config };
}

export const adguardPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/adguard", async ({ user, set }) => {
    try {
      const plugin = await getPluginConfigRecord("adguard");

      const config = normalizeAdguardConfig(plugin?.config);
      const rawConfig =
        plugin?.config &&
        typeof plugin.config === "object" &&
        !Array.isArray(plugin.config)
          ? (plugin.config as Record<string, unknown>)
          : null;

      return {
        plugin: {
          type: "adguard",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          username:
            config?.username ||
            (typeof rawConfig?.username === "string" ? rawConfig.username : ""),
          password_set: Boolean(config?.password),
        },
      };
    } catch (error) {
      console.error("Error fetching AdGuard Home plugin config:", error);
      return serverError(set, "Failed to fetch AdGuard Home plugin config");
    }
  })
  .put(
    "/adguard",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const username = body.username.trim();

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      if (!username) {
        return badRequest(set, "username is required");
      }

      try {
        const existingPlugin = await getPluginConfigRecord("adguard");
        const existingConfig = normalizeAdguardConfig(existingPlugin?.config);
        const providedPassword = body.password?.trim() || "";
        const password = providedPassword || existingConfig?.password || "";

        if (!password) {
          return badRequest(set, "password is required");
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
        };

        const plugin = await prisma.plugin.upsert({
          where: { type: "adguard" },
          update: {
            enabled,
            config,
            updatedAt: now,
          },
          create: {
            type: "adguard",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });
        await invalidatePluginConfigCache("adguard");

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "adguard" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            username,
            password_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving AdGuard Home plugin config:", error);
        return serverError(set, "Failed to save AdGuard Home plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        username: t.String(),
        password: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/adguard/protection",
    async ({ user, body, set }) => {
      try {
        const { config, error } = await getAdguardApiConfig(set);
        if (!config) {
          return { error: error || "AdGuard Home plugin is not configured" };
        }

        const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
        const protectionUrl = new URL(
          "/control/protection",
          config.website_url,
        );
        const statusUrl = new URL("/control/status", config.website_url);

        const protectionResponse = await fetch(protectionUrl.toString(), {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled: body.enabled }),
        });

        if (!protectionResponse.ok) {
          return badGateway(
            set,
            `AdGuard protection request failed with status ${protectionResponse.status}`,
          );
        }

        const statusResponse = await fetch(statusUrl.toString(), {
          headers: {
            Accept: "application/json",
            Authorization: authHeader,
          },
        });

        if (!statusResponse.ok) {
          return badGateway(
            set,
            `AdGuard status request failed with status ${statusResponse.status}`,
          );
        }

        const statusPayload = (await statusResponse.json()) as unknown;
        const status =
          statusPayload &&
          typeof statusPayload === "object" &&
          !Array.isArray(statusPayload)
            ? (statusPayload as Record<string, unknown>)
            : null;

        if (!status) {
          return badGateway(set, "Invalid AdGuard Home status payload");
        }

        return {
          success: true,
          protection_enabled: toBoolean(status.protection_enabled),
        };
      } catch (error) {
        console.error("Error updating AdGuard Home protection:", error);
        return serverError(set, "Failed to update AdGuard Home protection");
      }
    },
    {
      body: t.Object({
        enabled: t.Boolean(),
      }),
    },
  );
