import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import {
  normalizeQbittorrentConfig,
  invalidateQbittorrentPluginConfigCache,
  getQbittorrentPluginConfig,
} from "@hously/api/services/qbittorrent/config";
import {
  clampInteger,
  isValidHttpUrl,
  normalizeUrl,
} from "@hously/api/utils/plugins/utils";
import { encrypt } from "@hously/api/services/crypto";
import { randomBytes } from "node:crypto";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import { getBaseUrl, loadConfig } from "@hously/api/config";
import { qbFetchText } from "@hously/api/services/qbittorrent/client";
import { lookup as dnsLookup } from "node:dns/promises";

/**
 * Resolve the URL qBittorrent should use to reach Hously internally.
 *
 * Priority:
 *   1. Explicit override from the request body
 *   2. Docker service DNS — probe "hously" on the configured API port.
 *      Inside Docker, the service name is always resolvable from the same
 *      homelab_network, so this works for qBittorrent (via vpn-stack) without
 *      any env-var configuration.
 *   3. BASE_URL fallback (public URL — last resort)
 */
async function resolveHouslyInternalUrl(override?: string): Promise<string> {
  if (override) {
    let parsed: URL;
    try {
      parsed = new URL(override);
    } catch {
      throw new Error("Hously URL override is not a valid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Hously URL override must use http or https");
    }
    return override.replace(/\/$/, "");
  }

  const port = loadConfig().API_PORT;
  try {
    await dnsLookup("hously");
    return `http://hously:${port}`;
  } catch {
    return getBaseUrl().replace(/\/$/, "");
  }
}

export const qbittorrentPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/qbittorrent", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "qbittorrent" },
      });

      const config = normalizeQbittorrentConfig(plugin?.config);
      return {
        plugin: {
          type: "qbittorrent",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          username: config?.username || "",
          password_set: Boolean(config?.password),
          poll_interval_seconds: config?.poll_interval_seconds || 1,
          max_items: config?.max_items || 8,
          hously_base_url: getBaseUrl(),
          webhook_secret_configured: Boolean(config?.webhook_secret),
        },
      };
    } catch (error) {
      console.error("Error fetching qBittorrent plugin config:", error);
      return serverError(set, "Failed to fetch qBittorrent plugin config");
    }
  })
  .put(
    "/qbittorrent",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const username = body.username.trim();
      const pollIntervalSeconds = clampInteger(
        body.poll_interval_seconds,
        1,
        30,
        1,
      );
      const maxItems = clampInteger(body.max_items, 3, 30, 8);

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
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: "qbittorrent" },
        });
        const existingConfig = normalizeQbittorrentConfig(
          existingPlugin?.config,
        );
        const providedPassword = body.password?.trim() || "";
        const password = providedPassword || existingConfig?.password || "";

        if (!password) {
          return badRequest(set, "password is required");
        }

        // Auto-generate a webhook secret on first save; preserve it on subsequent saves.
        const webhookSecret =
          existingConfig?.webhook_secret || randomBytes(16).toString("hex");

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
          poll_interval_seconds: pollIntervalSeconds,
          max_items: maxItems,
          webhook_secret: encrypt(webhookSecret),
        };

        const plugin = await prisma.plugin.upsert({
          where: { type: "qbittorrent" },
          update: {
            enabled,
            config,
            updatedAt: now,
          },
          create: {
            type: "qbittorrent",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });

        await invalidateQbittorrentPluginConfigCache();

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "qbittorrent" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            username,
            password_set: true,
            poll_interval_seconds: pollIntervalSeconds,
            max_items: maxItems,
          },
        };
      } catch (error) {
        console.error("Error saving qBittorrent plugin config:", error);
        return serverError(set, "Failed to save qBittorrent plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        username: t.String(),
        password: t.Optional(t.String()),
        poll_interval_seconds: t.Optional(t.Numeric()),
        max_items: t.Optional(t.Numeric()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/qbittorrent/autorun-setup",
    async ({ body, set }) => {
      const qb = await getQbittorrentPluginConfig();
      if (!qb.enabled || !qb.config) {
        return badRequest(
          set,
          "qBittorrent plugin is not configured or disabled.",
        );
      }

      const secret = qb.config.webhook_secret;
      if (!secret) {
        return badRequest(
          set,
          "Webhook secret not generated yet. Save the plugin settings first.",
        );
      }

      let houslyUrl: string;
      try {
        houslyUrl = await resolveHouslyInternalUrl(body.hously_url?.trim());
      } catch (e) {
        return badRequest(set, e instanceof Error ? e.message : "Invalid Hously URL");
      }

      // Build the autorun commands. qBittorrent substitutes %I (info hash) before
      // spawning via QProcess::splitCommand, which only understands double-quote
      // grouping (NOT single quotes). We call curl directly — no shell needed —
      // and pass the hash as a URL query parameter to avoid any JSON quoting.
      const makeCmd = (endpoint: string) =>
        `/usr/bin/curl -s -X POST "${houslyUrl}${endpoint}?hash=%I" -H "Authorization: Bearer ${secret}"`;

      const prefs = {
        autorun_enabled: true,
        autorun_program: makeCmd("/api/webhooks/qbittorrent/completed"),
        // autorun_on_torrent_added_* requires qBittorrent ≥ 4.5.0
        autorun_on_torrent_added_enabled: true,
        autorun_on_torrent_added_program: makeCmd(
          "/api/webhooks/qbittorrent/added",
        ),
      };

      try {
        const formBody = new URLSearchParams({ json: JSON.stringify(prefs) });
        await qbFetchText(qb.config, "/api/v2/app/setPreferences", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody.toString(),
        });
        return { success: true, hously_url: houslyUrl };
      } catch (error) {
        console.error("Error configuring qBittorrent autorun:", error);
        return serverError(
          set,
          "Failed to update qBittorrent preferences. Check that qBittorrent is reachable.",
        );
      }
    },
    {
      body: t.Object({
        hously_url: t.Optional(t.String()),
      }),
    },
  );
