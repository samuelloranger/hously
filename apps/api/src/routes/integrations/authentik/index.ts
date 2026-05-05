import { Elysia, t } from "elysia";
import type { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { requireAdmin } from "@hously/api/middleware/auth";
import { encrypt } from "@hously/api/services/crypto";
import {
  getIntegrationConfigRecord,
  invalidateIntegrationConfigCache,
} from "@hously/api/services/integrationConfigCache";
import { badRequest, serverError } from "@hously/api/errors";
import { refreshAuthentikConfig } from "@hously/api/lib/auth";
import { nowUtc } from "@hously/api/utils";
import { logActivity } from "@hously/api/utils/activityLogs";

type AuthentikConfig = {
  issuer_url: string;
  client_id: string;
  client_secret: string;
};

function normalizeAuthentikConfig(config: unknown): AuthentikConfig | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const record = config as Record<string, unknown>;
  const issuerUrl =
    typeof record.issuer_url === "string" ? record.issuer_url : "";
  const clientId = typeof record.client_id === "string" ? record.client_id : "";
  const clientSecret =
    typeof record.client_secret === "string" ? record.client_secret : "";

  if (!issuerUrl || !clientId || !clientSecret) return null;
  return {
    issuer_url: issuerUrl,
    client_id: clientId,
    client_secret: clientSecret,
  };
}

export const authentikIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/authentik", async ({ set }) => {
    try {
      const integration = await getIntegrationConfigRecord("authentik");
      const config = normalizeAuthentikConfig(integration?.config);
      return {
        integration: {
          type: "authentik",
          enabled: integration?.enabled || false,
          issuer_url: config?.issuer_url || "",
          client_id: config?.client_id || "",
          client_secret_set: Boolean(config?.client_secret),
        },
      };
    } catch (error) {
      console.error("Error fetching Authentik integration config:", error);
      return serverError(set, "Failed to fetch Authentik integration config");
    }
  })
  .put(
    "/authentik",
    async ({ user, body, set }) => {
      const issuerUrl = body.issuer_url.trim().replace(/\/$/, "");
      const clientId = body.client_id.trim();

      if (!issuerUrl || !/^https?:\/\//.test(issuerUrl)) {
        return badRequest(set, "issuer_url must be a valid http(s) URL");
      }
      if (!clientId) {
        return badRequest(set, "client_id is required");
      }

      try {
        const existing = await getIntegrationConfigRecord("authentik");
        const existingConfig = normalizeAuthentikConfig(existing?.config);
        const clientSecret =
          body.client_secret?.trim() || existingConfig?.client_secret || "";

        if (!clientSecret) {
          return badRequest(set, "client_secret is required");
        }

        const enabled = body.enabled ?? existing?.enabled ?? true;
        const now = nowUtc();
        const config: Prisma.InputJsonValue = {
          issuer_url: issuerUrl,
          client_id: clientId,
          client_secret: body.client_secret?.trim()
            ? encrypt(clientSecret)
            : clientSecret,
        };

        await prisma.integration.upsert({
          where: { type: "authentik" },
          update: { enabled, config, updatedAt: now },
          create: {
            type: "authentik",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });
        invalidateIntegrationConfigCache("authentik");
        refreshAuthentikConfig();

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "authentik" },
        });

        return {
          success: true,
          integration: {
            type: "authentik",
            enabled,
            issuer_url: issuerUrl,
            client_id: clientId,
            client_secret_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving Authentik integration config:", error);
        return serverError(set, "Failed to save Authentik integration config");
      }
    },
    {
      body: t.Object({
        issuer_url: t.String(),
        client_id: t.String(),
        client_secret: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
