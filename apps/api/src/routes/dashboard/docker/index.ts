import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireAdmin } from "@hously/api/middleware/auth";
import { fetchDockerSummary } from "@hously/api/utils/dashboard/docker";
import { serverError } from "@hously/api/errors";

export const dashboardDockerRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/docker/summary", async ({ user: _user, set }) => {
    try {
      return await fetchDockerSummary();
    } catch (error) {
      console.error("Error fetching Docker summary:", error);
      return serverError(set, "Failed to get Docker summary");
    }
  });
