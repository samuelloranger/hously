import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import {
  getPluginConfigRecord,
  invalidatePluginConfigCache,
} from "@hously/api/services/pluginConfigCache";
import {
  deleteCache,
  getJsonCache,
  setJsonCache,
} from "@hously/api/services/cache";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeUptimekumaConfig } from "@hously/api/utils/plugins/normalizers";
import {
  parseMonitorStatus,
  summariseMonitors,
  type UptimekumaMonitor,
  type UptimekumaSummary,
} from "@hously/api/utils/plugins/uptimekuma";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin, requireUser } from "@hously/api/middleware/auth";
import { badGateway, badRequest, serverError } from "@hously/api/errors";

const CACHE_KEY = "plugin:uptimekuma:monitors";
const CACHE_TTL_SECONDS = 60;

type MonitorsResponse = {
  summary: UptimekumaSummary;
  monitors: UptimekumaMonitor[];
  fetched_at: string;
};

const adminRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/uptimekuma", async ({ set }) => {
    try {
      const plugin = await getPluginConfigRecord("uptimekuma");
      const config = normalizeUptimekumaConfig(plugin?.config);
      return {
        plugin: {
          type: "uptimekuma" as const,
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key_set: Boolean(config?.api_key),
        },
      };
    } catch (error) {
      console.error("Error fetching UptimeKuma plugin config:", error);
      return serverError(set, "Failed to fetch UptimeKuma plugin config");
    }
  })
  .put(
    "/uptimekuma",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      try {
        const existingPlugin = await getPluginConfigRecord("uptimekuma");
        const existingConfig = normalizeUptimekumaConfig(
          existingPlugin?.config,
        );
        const providedKey = body.api_key?.trim() || "";
        const apiKey = providedKey || existingConfig?.api_key || "";

        if (!apiKey) {
          return badRequest(set, "api_key is required");
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          api_key: encrypt(apiKey),
        };

        await prisma.plugin.upsert({
          where: { type: "uptimekuma" },
          update: { enabled, config, updatedAt: now },
          create: {
            type: "uptimekuma",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });
        await invalidatePluginConfigCache("uptimekuma");
        await deleteCache(CACHE_KEY);

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "uptimekuma" },
        });

        return {
          success: true as const,
          plugin: {
            type: "uptimekuma" as const,
            enabled,
            website_url: websiteUrl,
            api_key_set: true,
          },
        };
      } catch (error) {
        console.error("Error saving UptimeKuma plugin config:", error);
        return serverError(set, "Failed to save UptimeKuma plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );

const userRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/uptimekuma/monitors", async ({ set }) => {
    try {
      const cached = await getJsonCache<MonitorsResponse>(CACHE_KEY);
      if (cached) return cached;

      const plugin = await getPluginConfigRecord("uptimekuma");
      if (!plugin?.enabled) {
        return badRequest(set, "UptimeKuma plugin is not enabled");
      }
      const config = normalizeUptimekumaConfig(plugin.config);
      if (!config) {
        return badRequest(set, "UptimeKuma plugin is not configured");
      }

      const metricsUrl = new URL("/metrics", config.website_url);
      const authHeader = `Basic ${Buffer.from(`:${config.api_key}`).toString("base64")}`;

      const response = await fetch(metricsUrl.toString(), {
        headers: {
          Accept: "text/plain",
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        return badGateway(
          set,
          `UptimeKuma /metrics request failed with status ${response.status}`,
        );
      }

      const text = await response.text();
      const monitors = parseMonitorStatus(text);
      const summary = summariseMonitors(monitors);
      const payload: MonitorsResponse = {
        summary,
        monitors,
        fetched_at: new Date().toISOString(),
      };
      await setJsonCache(CACHE_KEY, payload, CACHE_TTL_SECONDS);
      return payload;
    } catch (error) {
      console.error("Error fetching UptimeKuma monitors:", error);
      return serverError(set, "Failed to fetch UptimeKuma monitors");
    }
  });

export const uptimekumaPluginRoutes = new Elysia()
  .use(adminRoutes)
  .use(userRoutes);
