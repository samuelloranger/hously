import { fetchApi } from '../../lib/api';

export interface JellyfinPlugin {
  type: 'jellyfin';
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export interface JellyfinPluginUpdateResponse {
  success: boolean;
  plugin: JellyfinPlugin;
  queued?: boolean;
  message?: string;
}

export const pluginsApi = {
  async getJellyfinPlugin(): Promise<{ plugin: JellyfinPlugin }> {
    return fetchApi<{ plugin: JellyfinPlugin }>('/api/plugins/jellyfin');
  },

  async updateJellyfinPlugin(data: {
    website_url: string;
    api_key: string;
    enabled: boolean;
  }): Promise<JellyfinPluginUpdateResponse> {
    return fetchApi<JellyfinPluginUpdateResponse>('/api/plugins/jellyfin', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
