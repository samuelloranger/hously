import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { fetchScrutinySummary } from "@hously/api/utils/dashboard/scrutiny";
import { serverError } from "@hously/api/errors";

export const dashboardScrutinyRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/scrutiny/summary", async ({ user, set }) => {
    try {
      return await fetchScrutinySummary();
    } catch (error) {
      console.error("Error fetching Scrutiny summary:", error);
      return serverError(set, "Failed to get Scrutiny summary");
    }
  });
