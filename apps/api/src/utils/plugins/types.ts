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

export interface ProwlarrPluginConfig {
  api_key: string;
  website_url: string;
}

export interface ScrutinyPluginConfig {
  website_url: string;
}

export interface NetdataPluginConfig {
  website_url: string;
}

export interface AdguardPluginConfig {
  website_url: string;
  username: string;
  password: string;
}

export interface WeatherPluginConfig {
  address: string;
  temperature_unit: 'fahrenheit' | 'celsius';
}

export interface TmdbPluginConfig {
  api_key: string;
  popularity_threshold: number;
}

export interface RedditPluginConfig {
  subreddits: string[];
}

export interface HackernewsPluginConfig {
  feed_type: 'top' | 'best' | 'new' | 'ask' | 'show' | 'job';
  story_count: number;
}

export type TrackerType = 'c411' | 'torr9' | 'la-cale';

export interface TrackerPluginConfig {
  flaresolverr_url?: string;
  tracker_url: string;
  username: string;
  password?: string;
}
