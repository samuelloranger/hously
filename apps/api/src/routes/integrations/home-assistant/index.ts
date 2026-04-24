import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { nowUtc } from "@hously/api/utils";
import { normalizeHomeAssistantConfig } from "@hously/api/utils/integrations/normalizers";
import { normalizeUrl } from "@hously/api/utils/integrations/utils";
import { encrypt } from "@hously/api/services/crypto";
import {
  assertValidHaBaseUrl,
  haListDiscoverableEntities,
} from "@hously/api/services/homeAssistant";
import { haDomainFromEntityId } from "@hously/api/utils/integrations/homeAssistantUtils";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const homeAssistantIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/home-assistant/entities", async ({ set }) => {
    try {
      const integration = await getIntegrationConfigRecord("home-assistant");
      if (!integration?.enabled) {
        return badRequest(set, "Enable the Home Assistant integration first");
      }
      const cfg = normalizeHomeAssistantConfig(integration.config);
      if (!cfg) {
        return badRequest(set, "Home Assistant is not configured");
      }

      const list = await haListDiscoverableEntities(
        cfg.base_url,
        cfg.access_token,
      );
      if (!list.ok) {
        set.status =
          list.status >= 400 && list.status < 600 ? list.status : 502;
        return { error: list.message };
      }

      const entities = list.entities.map((s) => {
        const domain = haDomainFromEntityId(s.entity_id)!;
        const attrs =
          s.attributes && typeof s.attributes === "object"
            ? (s.attributes as Record<string, unknown>)
            : {};
        const friendly =
          typeof attrs.friendly_name === "string" && attrs.friendly_name.trim()
            ? attrs.friendly_name.trim()
            : s.entity_id;
        return { entity_id: s.entity_id, friendly_name: friendly, domain };
      });

      return { entities };
    } catch (error) {
      console.error("Error listing Home Assistant entities:", error);
      return serverError(set, "Failed to list Home Assistant devices");
    }
  })
  .get("/home-assistant", async ({ set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "home-assistant" },
      });
      const cfg = normalizeHomeAssistantConfig(integration?.config);

      return {
        integration: {
          type: "home-assistant" as const,
          enabled: integration?.enabled || false,
          base_url: cfg?.base_url || "",
          access_token: "",
          enabled_entity_ids: cfg?.enabled_entity_ids ?? [],
        },
      };
    } catch (error) {
      console.error("Error fetching Home Assistant integration config:", error);
      return serverError(
        set,
        "Failed to fetch Home Assistant integration config",
      );
    }
  })
  .put(
    "/home-assistant",
    async ({ user, body, set }) => {
      const baseUrl = normalizeUrl(body.base_url);
      const enabled = body.enabled ?? true;
      const rawIds = body.enabled_entity_ids ?? [];
      const enabledEntityIds = [
        ...new Set(rawIds.map((id) => id.trim()).filter(Boolean)),
      ].filter((id) => haDomainFromEntityId(id) !== null);

      if (!baseUrl || !assertValidHaBaseUrl(baseUrl)) {
        return badRequest(
          set,
          "Invalid base_url. Use http(s) URL of your Home Assistant instance (e.g. https://homeassistant.local:8123).",
        );
      }

      const existingIntegration = await prisma.integration.findFirst({
        where: { type: "home-assistant" },
      });
      const existingCfg = normalizeHomeAssistantConfig(
        existingIntegration?.config,
      );
      const providedToken = body.access_token.trim();

      let accessTokenEncrypted: string;
      if (providedToken) {
        accessTokenEncrypted = encrypt(providedToken);
      } else if (existingCfg) {
        const raw = existingIntegration?.config as Record<
          string,
          unknown
        > | null;
        const prev =
          typeof raw?.access_token === "string" ? raw.access_token : "";
        if (!prev) {
          return badRequest(set, "access_token is required");
        }
        accessTokenEncrypted = prev;
      } else {
        return badRequest(set, "access_token is required");
      }

      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
          where: { type: "home-assistant" },
          update: {
            enabled,
            config: {
              base_url: baseUrl,
              access_token: accessTokenEncrypted,
              enabled_entity_ids: enabledEntityIds,
            },
            updatedAt: now,
          },
          create: {
            type: "home-assistant",
            enabled,
            config: {
              base_url: baseUrl,
              access_token: accessTokenEncrypted,
              enabled_entity_ids: enabledEntityIds,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "home-assistant" },
        });

        const saved = normalizeHomeAssistantConfig(integration.config);

        return {
          success: true,
          integration: {
            type: "home-assistant" as const,
            enabled: integration.enabled,
            base_url: saved?.base_url || baseUrl,
            access_token: "",
            enabled_entity_ids: saved?.enabled_entity_ids ?? enabledEntityIds,
          },
        };
      } catch (error) {
        console.error("Error saving Home Assistant integration config:", error);
        return serverError(
          set,
          "Failed to save Home Assistant integration config",
        );
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        access_token: t.String(),
        enabled_entity_ids: t.Array(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
