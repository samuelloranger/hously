import { Elysia, t } from "elysia";
import { auth } from "../../../auth";
import { prisma } from "../../../db";
import { nowUtc } from "../../../utils";
import { normalizeHackernewsConfig } from "../../../utils/plugins/normalizers";
import { logActivity } from "../../../utils/activityLogs";
import { deleteCache } from "../../../services/cache";
import { requireAdmin } from "../../../middleware/auth";
import { serverError } from "../../../errors";

export const hackernewsPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/hackernews", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "hackernews" },
      });
      const config = normalizeHackernewsConfig(plugin?.config);

      return {
        plugin: {
          type: "hackernews",
          enabled: plugin?.enabled || false,
          feed_type: config?.feed_type || "top",
          story_count: config?.story_count || 10,
        },
      };
    } catch (error) {
      console.error("Error fetching Hacker News plugin config:", error);
      return serverError(set, "Failed to fetch Hacker News plugin config");
    }
  })
  .put(
    "/hackernews",
    async ({ user, body, set }) => {
      const validFeedTypes = [
        "top",
        "best",
        "new",
        "ask",
        "show",
        "job",
      ] as const;
      const feedType = validFeedTypes.includes(
        body.feed_type as (typeof validFeedTypes)[number],
      )
        ? body.feed_type
        : "top";
      const storyCount = Math.max(
        1,
        Math.min(Math.trunc(Number(body.story_count) || 10), 50),
      );
      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "hackernews" },
          update: {
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            updatedAt: now,
          },
          create: {
            type: "hackernews",
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache("dashboard:hackernews");

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "hackernews" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            feed_type: feedType,
            story_count: storyCount,
          },
        };
      } catch (error) {
        console.error("Error saving Hacker News plugin config:", error);
        return serverError(set, "Failed to save Hacker News plugin config");
      }
    },
    {
      body: t.Object({
        feed_type: t.String(),
        story_count: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
