import { Elysia } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { getJsonCache, setJsonCache } from "../../../services/cache";
import {
  fetchHackerNewsStories,
  HN_CACHE_TTL_SECONDS,
} from "../../../utils/dashboard/hackernews";
import type { DashboardHackerNewsResponse } from "../../../utils/dashboard/hackernews";
import { serverError } from "../../../errors";

export const dashboardHackernewsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/hackernews", async ({ user, set }) => {
    try {
      const cached = await getJsonCache<DashboardHackerNewsResponse>(
        "dashboard:hackernews",
      );
      if (cached) {
        return cached;
      }

      const result = await fetchHackerNewsStories();
      if (result.enabled && result.stories.length > 0) {
        await setJsonCache(
          "dashboard:hackernews",
          result,
          HN_CACHE_TTL_SECONDS,
        );
      }
      return result;
    } catch (error) {
      console.error("Error fetching Hacker News stories:", error);
      return serverError(set, "Failed to get Hacker News stories");
    }
  });
