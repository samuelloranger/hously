import { fetchApi } from '../../lib/api';
import type {
  DashboardJellyfinLatestResponse,
  DashboardQbittorrentStatusResponse,
  DashboardStatsResponse,
  DashboardUpcomingResponse,
} from '../../types';

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

  async addUpcomingToArr(data: {
    media_type: 'movie' | 'tv';
    tmdb_id: number;
    search_on_add: boolean;
  }): Promise<{
    success: boolean;
    service: 'radarr' | 'sonarr';
    added: boolean;
    already_exists: boolean;
  }> {
    return fetchApi<{
      success: boolean;
      service: 'radarr' | 'sonarr';
      added: boolean;
      already_exists: boolean;
    }>('/api/dashboard/upcoming/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getUpcomingStatus(data: { media_type: 'movie' | 'tv'; tmdb_id: number }): Promise<{
    exists: boolean;
    service: 'radarr' | 'sonarr';
  }> {
    return fetchApi<{ exists: boolean; service: 'radarr' | 'sonarr' }>('/api/dashboard/upcoming/status', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getDashboardQbittorrentStatus(): Promise<DashboardQbittorrentStatusResponse> {
    return fetchApi<DashboardQbittorrentStatusResponse>('/api/dashboard/qbittorrent/status');
  },
};
