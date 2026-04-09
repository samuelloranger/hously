export interface ArrProfile {
  id: number;
  name: string;
}

export type TrackerType = "c411" | "torr9" | "la-cale";

export interface JellyfinPlugin {
  type: "jellyfin";
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export interface RadarrPlugin {
  type: "radarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
}

export interface SonarrPlugin {
  type: "sonarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

export interface ProwlarrPlugin {
  type: "prowlarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export interface QbittorrentPlugin {
  type: "qbittorrent";
  enabled: boolean;
  website_url: string;
  username: string;
  password_set: boolean;
  poll_interval_seconds: number;
  max_items: number;
}

export interface ScrutinyPlugin {
  type: "scrutiny";
  enabled: boolean;
  website_url: string;
}

export interface BeszelPlugin {
  type: "beszel";
  enabled: boolean;
  website_url: string;
  email: string;
  password_set: boolean;
}

export interface AdguardPlugin {
  type: "adguard";
  enabled: boolean;
  website_url: string;
  username: string;
  password_set: boolean;
}

export interface WeatherPlugin {
  type: "weather";
  enabled: boolean;
  address: string;
  temperature_unit: "fahrenheit" | "celsius";
}

export interface TmdbPlugin {
  type: "tmdb";
  enabled: boolean;
  api_key: string;
  popularity_threshold: number;
}

export interface TrackerPlugin {
  type: TrackerType;
  enabled: boolean;
  tracker_url: string;
  flaresolverr_url: string;
  username: string;
  password_set: boolean;
}

export interface HomeAssistantPlugin {
  type: "home-assistant";
  enabled: boolean;
  base_url: string;
  /** Always empty in API responses; token is server-only. */
  access_token: string;
  enabled_entity_ids: string[];
}

export interface HomeAssistantDiscoverEntity {
  entity_id: string;
  friendly_name: string;
  domain: "light" | "switch";
}

export interface HomeAssistantWidgetEntity {
  entity_id: string;
  state: string;
  friendly_name: string;
  domain: "light" | "switch";
}

export interface HomeAssistantWidgetResponse {
  plugin_enabled: boolean;
  entities: HomeAssistantWidgetEntity[];
}

export interface HomeAssistantPluginUpdateResponse {
  success: boolean;
  plugin: HomeAssistantPlugin;
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

export interface ProwlarrPluginUpdateResponse {
  success: boolean;
  plugin: ProwlarrPlugin;
}

export interface QbittorrentPluginUpdateResponse {
  success: boolean;
  plugin: QbittorrentPlugin;
}

export interface ScrutinyPluginUpdateResponse {
  success: boolean;
  plugin: ScrutinyPlugin;
}

export interface BeszelPluginUpdateResponse {
  success: boolean;
  plugin: BeszelPlugin;
}

export interface AdguardPluginUpdateResponse {
  success: boolean;
  plugin: AdguardPlugin;
}

export interface AdguardProtectionUpdateResponse {
  success: boolean;
  protection_enabled: boolean;
}

export interface WeatherPluginUpdateResponse {
  success: boolean;
  plugin: WeatherPlugin;
}

export interface TmdbPluginUpdateResponse {
  success: boolean;
  plugin: TmdbPlugin;
}

export interface TrackerPluginUpdateResponse {
  success: boolean;
  plugin: TrackerPlugin;
}

export interface HomeAssistantDiscoverResponse {
  entities: HomeAssistantDiscoverEntity[];
}
