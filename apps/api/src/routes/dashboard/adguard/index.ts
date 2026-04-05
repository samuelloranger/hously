import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { fetchAdguardSummary } from "@hously/api/utils/dashboard/adguard";
import { serverError } from "@hously/api/errors";

export const dashboardAdguardRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/adguard/summary", async ({ user, set }) => {
    try {
      return await fetchAdguardSummary();
    } catch (error) {
      console.error("Error fetching AdGuard Home summary:", error);
      return serverError(set, "Failed to get AdGuard Home summary");
    }
  });
