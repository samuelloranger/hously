import { fetchApi } from "../../lib/api";
import type { DashboardStatsResponse } from "../../types";

export const dashboardApi = {
  // Elysia endpoint
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return fetchApi<DashboardStatsResponse>("/api/dashboard/stats");
  },

  // Legacy Python API
  async getDashboardActivities(): Promise<{
    activities: DashboardStatsResponse["activities"];
  }> {
    return fetchApi<{ activities: DashboardStatsResponse["activities"] }>(
      `/api/dashboard/activities`,
    );
  },
};
