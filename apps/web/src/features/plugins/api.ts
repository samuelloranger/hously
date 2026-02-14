import { fetchApi } from '../../lib/api';

export interface JellyfinPlugin {
  type: 'jellyfin';
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export interface RadarrPlugin {
  type: 'radarr';
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
}

export interface SonarrPlugin {
  type: 'sonarr';
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

export interface QbittorrentPlugin {
  type: 'qbittorrent';
  enabled: boolean;
  website_url: string;
  username: string;
  password_set: boolean;
  poll_interval_seconds: number;
  max_items: number;
}

export interface JellyfinPluginUpdateResponse {
  success: boolean;
  plugin: JellyfinPlugin;
  queued?: boolean;
  message?: string;
}

export interface RadarrPluginUpdateResponse {
  success: boolean;
  plugin: RadarrPlugin;
}

export interface SonarrPluginUpdateResponse {
  success: boolean;
  plugin: SonarrPlugin;
}

export interface QbittorrentPluginUpdateResponse {
  success: boolean;
  plugin: QbittorrentPlugin;
}

export interface ArrProfile {
  id: number;
  name: string;
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

  async getRadarrPlugin(): Promise<{ plugin: RadarrPlugin }> {
    return fetchApi<{ plugin: RadarrPlugin }>('/api/plugins/radarr');
  },

  async updateRadarrPlugin(data: {
    website_url: string;
    api_key: string;
    root_folder_path: string;
    quality_profile_id: number;
    enabled: boolean;
  }): Promise<RadarrPluginUpdateResponse> {
    return fetchApi<RadarrPluginUpdateResponse>('/api/plugins/radarr', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getRadarrProfiles(data: { website_url: string; api_key: string }): Promise<{ quality_profiles: ArrProfile[] }> {
    return fetchApi<{ quality_profiles: ArrProfile[] }>('/api/plugins/radarr/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSonarrPlugin(): Promise<{ plugin: SonarrPlugin }> {
    return fetchApi<{ plugin: SonarrPlugin }>('/api/plugins/sonarr');
  },

  async updateSonarrPlugin(data: {
    website_url: string;
    api_key: string;
    root_folder_path: string;
    quality_profile_id: number;
    language_profile_id: number;
    enabled: boolean;
  }): Promise<SonarrPluginUpdateResponse> {
    return fetchApi<SonarrPluginUpdateResponse>('/api/plugins/sonarr', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getSonarrProfiles(data: {
    website_url: string;
    api_key: string;
  }): Promise<{ quality_profiles: ArrProfile[]; language_profiles: ArrProfile[] }> {
    return fetchApi<{ quality_profiles: ArrProfile[]; language_profiles: ArrProfile[] }>('/api/plugins/sonarr/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getQbittorrentPlugin(): Promise<{ plugin: QbittorrentPlugin }> {
    return fetchApi<{ plugin: QbittorrentPlugin }>('/api/plugins/qbittorrent');
  },

  async updateQbittorrentPlugin(data: {
    website_url: string;
    username: string;
    password?: string;
    poll_interval_seconds?: number;
    max_items?: number;
    enabled: boolean;
  }): Promise<QbittorrentPluginUpdateResponse> {
    return fetchApi<QbittorrentPluginUpdateResponse>('/api/plugins/qbittorrent', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
