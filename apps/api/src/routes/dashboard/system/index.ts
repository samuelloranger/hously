import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import {
  fetchSystemSummary,
  buildSystemDisabledSummary,
} from "@hously/api/utils/dashboard/system";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import { serverError } from "@hously/api/errors";

export const dashboardSystemRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/system/summary", async ({ user, set }) => {
    try {
      return await fetchSystemSummary();
    } catch (error) {
      console.error("Error fetching system summary:", error);
      return serverError(set, "Failed to get system summary");
    }
  })
  .get("/system/stream", async ({ user, set, request }) => {
    return createJsonSseResponse({
      request,
      poll: fetchSystemSummary,
      intervalMs: 60000,
      retryMs: 10000,
      onError: () => ({
        ...buildSystemDisabledSummary("Failed to refresh system summary"),
        enabled: true,
        connected: false,
      }),
      logLabel: "System stream",
    });
  });
