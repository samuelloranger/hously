export interface ArrProfile {
  id: number;
  name: string;
}

export type TrackerType = 'ygg' | 'c411' | 'torr9' | 'g3mini' | 'la-cale';

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

export interface WeatherPlugin {
  type: 'weather';
  enabled: boolean;
  address: string;
  temperature_unit: 'fahrenheit' | 'celsius';
}

export interface TmdbPlugin {
  type: 'tmdb';
  enabled: boolean;
  api_key: string;
  popularity_threshold: number;
}

export interface RedditPlugin {
  type: 'reddit';
  enabled: boolean;
  subreddits: string[];
}

export interface RedditPluginUpdateResponse {
  success: boolean;
  plugin: RedditPlugin;
}

export interface RedditSubredditSearchResult {
  name: string;
  title: string;
  icon: string | null;
  subscribers: number;
}

export interface HackernewsPlugin {
  type: 'hackernews';
  enabled: boolean;
  feed_type: 'top' | 'best' | 'new' | 'ask' | 'show' | 'job';
  story_count: number;
}

export interface YggPlugin {
  type: 'ygg';
  enabled: boolean;
  flaresolverr_url: string;
  ygg_url: string;
  username: string;
  password_set: boolean;
}

export interface TrackerPlugin {
  type: TrackerType;
  enabled: boolean;
  tracker_url: string;
  flaresolverr_url: string;
  username: string;
  password_set: boolean;
}

export type C411Plugin = TrackerPlugin & { type: 'c411' };
export type Torr9Plugin = TrackerPlugin & { type: 'torr9' };
export type G3miniPlugin = TrackerPlugin & { type: 'g3mini' };
export type LaCalePlugin = TrackerPlugin & { type: 'la-cale' };

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

export interface WeatherPluginUpdateResponse {
  success: boolean;
  plugin: WeatherPlugin;
}

export interface TmdbPluginUpdateResponse {
  success: boolean;
  plugin: TmdbPlugin;
}

export interface YggPluginUpdateResponse {
  success: boolean;
  plugin: YggPlugin;
}

export interface HackernewsPluginUpdateResponse {
  success: boolean;
  plugin: HackernewsPlugin;
}

export interface TrackerPluginUpdateResponse {
  success: boolean;
  plugin: TrackerPlugin;
}
