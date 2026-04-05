import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import {
  normalizeQbittorrentConfig,
  invalidateQbittorrentPluginConfigCache,
} from "@hously/api/services/qbittorrent/config";
import { clampInteger, isValidHttpUrl } from "@hously/api/utils/plugins/utils";
import { encrypt } from "@hously/api/services/crypto";
import { logActivity } from "@hously/api/utils/activityLogs";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

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
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
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

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
          poll_interval_seconds: pollIntervalSeconds,
          max_items: maxItems,
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
  );
