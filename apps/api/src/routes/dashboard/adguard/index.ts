import { Elysia } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { fetchAdguardSummary } from "../../../utils/dashboard/adguard";
import { serverError } from "../../../errors";

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
