import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getIntegrationConfigRecord,
  invalidateIntegrationConfigCache,
} from "@hously/api/services/integrationConfigCache";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/integrations/utils";
import { normalizeAdguardConfig } from "@hously/api/utils/integrations/normalizers";
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
  const integration = await getIntegrationConfigRecord("adguard");

  if (!integration?.enabled) {
    return badRequest(set, "AdGuard Home integration is not enabled");
  }

  const config = normalizeAdguardConfig(integration.config);
  if (!config) {
    return badRequest(set, "AdGuard Home integration is not configured");
  }

  return { config };
}

export const adguardIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/adguard", async ({ user, set }) => {
    try {
      const integration = await getIntegrationConfigRecord("adguard");

      const config = normalizeAdguardConfig(integration?.config);
      const rawConfig =
        integration?.config &&
        typeof integration.config === "object" &&
        !Array.isArray(integration.config)
          ? (integration.config as Record<string, unknown>)
          : null;

      return {
        integration: {
          type: "adguard",
          enabled: integration?.enabled || false,
          website_url: config?.website_url || "",
          username:
            config?.username ||
            (typeof rawConfig?.username === "string" ? rawConfig.username : ""),
          password_set: Boolean(config?.password),
        },
      };
    } catch (error) {
      console.error("Error fetching AdGuard Home integration config:", error);
      return serverError(set, "Failed to fetch AdGuard Home integration config");
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
        const existingIntegration = await getIntegrationConfigRecord("adguard");
        const existingConfig = normalizeAdguardConfig(existingIntegration?.config);
        const providedPassword = body.password?.trim() || "";
        const password = providedPassword || existingConfig?.password || "";

        if (!password) {
          return badRequest(set, "password is required");
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingIntegration?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
        };

        const integration = await prisma.integration.upsert({
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
        await invalidateIntegrationConfigCache("adguard");

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "adguard" },
        });

        return {
          success: true,
          integration: {
            type: integration.type,
            enabled: integration.enabled,
            website_url: websiteUrl,
            username,
            password_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving AdGuard Home integration config:", error);
        return serverError(set, "Failed to save AdGuard Home integration config");
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
          return { error: error || "AdGuard Home integration is not configured" };
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
