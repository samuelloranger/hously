import { Elysia, t } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { getJsonCache, setJsonCache } from "../../../services/cache";
import {
  fetchRedditPosts,
  REDDIT_CACHE_TTL_SECONDS,
} from "../../../utils/dashboard/reddit";
import type { DashboardRedditResponse } from "../../../utils/dashboard/reddit";
import { serverError } from "../../../errors";

export const dashboardRedditRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/reddit",
    async ({ user, set, query }) => {
      try {
        const afterCursor = query.after;

        // Only cache the first page (no cursor)
        if (!afterCursor) {
          const cached =
            await getJsonCache<DashboardRedditResponse>("dashboard:reddit");
          if (cached) {
            return cached;
          }
        }

        const result = await fetchRedditPosts(afterCursor || undefined);

        if (!afterCursor && result.enabled && result.posts.length > 0) {
          await setJsonCache(
            "dashboard:reddit",
            result,
            REDDIT_CACHE_TTL_SECONDS,
          );
        }
        return result;
      } catch (error) {
        console.error("Error fetching Reddit posts:", error);
        return serverError(set, "Failed to get Reddit posts");
      }
    },
    {
      query: t.Object({
        after: t.Optional(t.String()),
      }),
    },
  );
