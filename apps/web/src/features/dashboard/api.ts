import { fetchApi } from '../../lib/api';
import type { DashboardJellyfinLatestResponse, DashboardStatsResponse, DashboardUpcomingResponse } from '../../types';

export const dashboardApi = {
  // Elysia endpoint
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return fetchApi<DashboardStatsResponse>('/api/dashboard/stats');
  },

  // Legacy Python API
  async getDashboardActivities(): Promise<{
    activities: DashboardStatsResponse['activities'];
  }> {
    return fetchApi<{ activities: DashboardStatsResponse['activities'] }>(`/api/dashboard/activities`);
  },

  async getDashboardJellyfinLatest(limit: number = 10): Promise<DashboardJellyfinLatestResponse> {
    return fetchApi<DashboardJellyfinLatestResponse>(`/api/dashboard/jellyfin/latest?limit=${limit}`);
  },

  async getDashboardUpcoming(limit: number = 8): Promise<DashboardUpcomingResponse> {
    return fetchApi<DashboardUpcomingResponse>(`/api/dashboard/upcoming?limit=${limit}`);
  },
};
