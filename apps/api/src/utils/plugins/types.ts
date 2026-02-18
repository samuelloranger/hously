export interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

export interface RadarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
}

export interface SonarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

export interface ScrutinyPluginConfig {
  website_url: string;
}

export interface NetdataPluginConfig {
  website_url: string;
}

export interface WeatherPluginConfig {
  address: string;
  temperature_unit: 'fahrenheit' | 'celsius';
}

export interface YggPluginConfig {
  flaresolverr_url?: string;
  ygg_url: string;
  username: string;
  password?: string;
}

export type TrackerType = 'ygg' | 'c411' | 'torr9' | 'g3mini';

export interface TrackerPluginConfig {
  flaresolverr_url?: string;
  tracker_url: string;
  username: string;
  password?: string;
}
