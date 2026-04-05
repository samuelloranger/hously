import { Elysia } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { fetchScrutinySummary } from "../../../utils/dashboard/scrutiny";
import { serverError } from "../../../errors";

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
