import { fetchApi } from '../../lib/api';

export interface JellyfinPlugin {
  type: 'jellyfin';
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export const pluginsApi = {
  async getJellyfinPlugin(): Promise<{ plugin: JellyfinPlugin }> {
    return fetchApi<{ plugin: JellyfinPlugin }>('/api/plugins/jellyfin');
  },

  async updateJellyfinPlugin(data: {
    website_url: string;
    api_key: string;
    enabled: boolean;
  }): Promise<{ success: boolean; plugin: JellyfinPlugin }> {
    return fetchApi<{ success: boolean; plugin: JellyfinPlugin }>('/api/plugins/jellyfin', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
