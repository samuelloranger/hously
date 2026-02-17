export interface ArrProfile {
  id: number;
  name: string;
}

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

export interface ScrutinyPlugin {
  type: 'scrutiny';
  enabled: boolean;
  website_url: string;
}

export interface NetdataPlugin {
  type: 'netdata';
  enabled: boolean;
  website_url: string;
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

export interface ScrutinyPluginUpdateResponse {
  success: boolean;
  plugin: ScrutinyPlugin;
}

export interface NetdataPluginUpdateResponse {
  success: boolean;
  plugin: NetdataPlugin;
}
