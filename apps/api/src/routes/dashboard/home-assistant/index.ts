import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { getPluginConfigRecord } from "@hously/api/services/pluginConfigCache";
import { requireUser } from "@hously/api/middleware/auth";
import { normalizeHomeAssistantConfig } from "@hously/api/utils/plugins/normalizers";
import {
  haCallService,
  haGetStatesForEntities,
} from "@hously/api/services/homeAssistant";
import {
  haDomainFromEntityId,
  haServiceNameForAction,
  type HaAllowedDomain,
} from "@hously/api/utils/plugins/homeAssistantUtils";
import { badRequest, serverError } from "@hously/api/errors";

function friendlyNameFromState(
  attributes: Record<string, unknown> | undefined,
  entityId: string,
): string {
  if (
    attributes &&
    typeof attributes.friendly_name === "string" &&
    attributes.friendly_name.trim()
  ) {
    return attributes.friendly_name.trim();
  }
  return entityId;
}

export const homeAssistantRoutes = new Elysia({ prefix: "/api/home-assistant" })
  .use(auth)
  .use(requireUser)
  .get("/widget", async ({ user: _user, set }) => {
    try {
      const plugin = await getPluginConfigRecord("home-assistant");
      if (!plugin?.enabled) {
        return { plugin_enabled: false, entities: [] as const };
      }

      const cfg = normalizeHomeAssistantConfig(plugin.config);
      if (!cfg || cfg.enabled_entity_ids.length === 0) {
        return { plugin_enabled: true, entities: [] as const };
      }

      const states = await haGetStatesForEntities(
        cfg.base_url,
        cfg.access_token,
        cfg.enabled_entity_ids,
      );
      if (!states.ok) {
        set.status =
          states.status >= 400 && states.status < 600 ? states.status : 502;
        return { error: states.message };
      }

      const entities = states.states.map((s) => {
        const domain = haDomainFromEntityId(s.entity_id)!;
        const attrs =
          s.attributes && typeof s.attributes === "object"
            ? (s.attributes as Record<string, unknown>)
            : {};
        return {
          entity_id: s.entity_id,
          state: s.state,
          friendly_name: friendlyNameFromState(attrs, s.entity_id),
          domain,
        };
      });

      return { plugin_enabled: true, entities };
    } catch (error) {
      console.error("Home Assistant widget:", error);
      return serverError(set, "Failed to load Home Assistant");
    }
  })
  .post(
    "/control",
    async ({ body, user: _user, set }) => {
      try {
        const plugin = await getPluginConfigRecord("home-assistant");
        if (!plugin?.enabled) {
          return badRequest(set, "Home Assistant plugin is not enabled");
        }

        const cfg = normalizeHomeAssistantConfig(plugin.config);
        if (!cfg) {
          return badRequest(set, "Home Assistant is not configured");
        }

        const entityId = body.entity_id.trim();
        const allowed = new Set(cfg.enabled_entity_ids);
        if (!allowed.has(entityId)) {
          return badRequest(set, "Entity is not enabled for this dashboard");
        }

        const domain = haDomainFromEntityId(entityId) as HaAllowedDomain | null;
        if (!domain) {
          return badRequest(set, "Unsupported entity domain");
        }

        const service = haServiceNameForAction(body.action);
        const result = await haCallService(
          cfg.base_url,
          cfg.access_token,
          domain,
          service,
          entityId,
        );
        if (!result.ok) {
          set.status =
            result.status >= 400 && result.status < 600 ? result.status : 502;
          return { error: result.message };
        }

        return { success: true as const };
      } catch (error) {
        console.error("Home Assistant control:", error);
        return serverError(set, "Failed to control device");
      }
    },
    {
      body: t.Object({
        entity_id: t.String(),
        action: t.Union([
          t.Literal("on"),
          t.Literal("off"),
          t.Literal("toggle"),
        ]),
      }),
    },
  );
