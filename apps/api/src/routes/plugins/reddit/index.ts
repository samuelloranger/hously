import { Elysia, t } from "elysia";
import { auth } from "../../../auth";
import { prisma } from "../../../db";
import { nowUtc } from "../../../utils";
import { normalizeRedditConfig } from "../../../utils/plugins/normalizers";
import { logActivity } from "../../../utils/activityLogs";
import { deleteCache } from "../../../services/cache";
import { searchSubreddits } from "../../../utils/dashboard/reddit";
import { requireAdmin } from "../../../middleware/auth";
import { badGateway, badRequest, serverError } from "../../../errors";

export const redditPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/reddit", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "reddit" },
      });
      const config = normalizeRedditConfig(plugin?.config);

      return {
        plugin: {
          type: "reddit",
          enabled: plugin?.enabled || false,
          subreddits: config.subreddits,
        },
      };
    } catch (error) {
      console.error("Error fetching Reddit plugin config:", error);
      return serverError(set, "Failed to fetch Reddit plugin config");
    }
  })
  .put(
    "/reddit",
    async ({ user, body, set }) => {
      const rawSubreddits = body.subreddits ?? [];
      const subreddits = rawSubreddits
        .map((s: string) => s.replace(/^r\//, "").trim())
        .filter((s: string) => /^[a-zA-Z0-9_]+$/.test(s));

      if (subreddits.length === 0) {
        return badRequest(set, "At least one valid subreddit is required");
      }

      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "reddit" },
          update: {
            enabled,
            config: { subreddits },
            updatedAt: now,
          },
          create: {
            type: "reddit",
            enabled,
            config: { subreddits },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache("dashboard:reddit");

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "reddit" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            subreddits,
          },
        };
      } catch (error) {
        console.error("Error saving Reddit plugin config:", error);
        return serverError(set, "Failed to save Reddit plugin config");
      }
    },
    {
      body: t.Object({
        subreddits: t.Array(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/reddit/search", async ({ user, set, query }) => {
    const q = (query as Record<string, string | undefined>).q?.trim() || "";
    if (q.length < 2) {
      return { results: [] };
    }

    try {
      const results = await searchSubreddits(q);
      return { results };
    } catch (error) {
      console.error("Error searching subreddits:", error);
      return badGateway(set, "Failed to search subreddits");
    }
  });
