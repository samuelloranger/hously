export interface ArrProfile {
  id: number;
  name: string;
}

export type TrackerType = "c411" | "torr9" | "la-cale";

export interface JellyfinIntegration {
  type: "jellyfin";
  enabled: boolean;
  website_url: string;
  api_key: string;
}

export interface RadarrIntegration {
  type: "radarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
}

export interface SonarrIntegration {
  type: "sonarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

export interface ProwlarrIntegration {
  type: "prowlarr";
  enabled: boolean;
  website_url: string;
  api_key: string;
  rss_indexers: string[];
}

export interface JackettIntegration {
  type: "jackett";
  enabled: boolean;
  website_url: string;
  api_key: string;
  rss_indexers: string[];
}

export interface QbittorrentIntegration {
  type: "qbittorrent";
  enabled: boolean;
  website_url: string;
  username: string;
  password_set: boolean;
  poll_interval_seconds: number;
  max_items: number;
}

export interface ScrutinyIntegration {
  type: "scrutiny";
  enabled: boolean;
  website_url: string;
}

export interface BeszelIntegration {
  type: "beszel";
  enabled: boolean;
  website_url: string;
  email: string;
  password_set: boolean;
}

export interface AdguardIntegration {
  type: "adguard";
  enabled: boolean;
  website_url: string;
  username: string;
  password_set: boolean;
}

export interface WeatherIntegration {
  type: "weather";
  enabled: boolean;
  address: string;
  temperature_unit: "fahrenheit" | "celsius";
}

export interface TmdbIntegration {
  type: "tmdb";
  enabled: boolean;
  api_key: string;
  popularity_threshold: number;
}

export interface TrackerIntegration {
  type: TrackerType;
  enabled: boolean;
  tracker_url: string;
  flaresolverr_url: string;
  username: string;
  password_set: boolean;
}

export interface HomeAssistantIntegration {
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
  integration_enabled: boolean;
  entities: HomeAssistantWidgetEntity[];
}

export interface HomeAssistantIntegrationUpdateResponse {
  success: boolean;
  integration: HomeAssistantIntegration;
}

export interface JellyfinIntegrationUpdateResponse {
  success: boolean;
  integration: JellyfinIntegration;
  queued?: boolean;
  message?: string;
}

export interface RadarrIntegrationUpdateResponse {
  success: boolean;
  integration: RadarrIntegration;
}

export interface SonarrIntegrationUpdateResponse {
  success: boolean;
  integration: SonarrIntegration;
}

export interface ProwlarrIntegrationUpdateResponse {
  success: boolean;
  integration: ProwlarrIntegration;
}

export interface JackettIntegrationUpdateResponse {
  success: boolean;
  integration: JackettIntegration;
}

export interface QbittorrentIntegrationUpdateResponse {
  success: boolean;
  integration: QbittorrentIntegration;
}

export interface ScrutinyIntegrationUpdateResponse {
  success: boolean;
  integration: ScrutinyIntegration;
}

export interface BeszelIntegrationUpdateResponse {
  success: boolean;
  integration: BeszelIntegration;
}

export interface AdguardIntegrationUpdateResponse {
  success: boolean;
  integration: AdguardIntegration;
}

export interface AdguardProtectionUpdateResponse {
  success: boolean;
  protection_enabled: boolean;
}

export interface WeatherIntegrationUpdateResponse {
  success: boolean;
  integration: WeatherIntegration;
}

export interface TmdbIntegrationUpdateResponse {
  success: boolean;
  integration: TmdbIntegration;
}

export interface TrackerIntegrationUpdateResponse {
  success: boolean;
  integration: TrackerIntegration;
}

export interface HomeAssistantDiscoverResponse {
  entities: HomeAssistantDiscoverEntity[];
}

export interface UptimekumaIntegration {
  type: "uptimekuma";
  enabled: boolean;
  website_url: string;
  api_key_set: boolean;
}

export interface UptimekumaIntegrationUpdateResponse {
  success: true;
  integration: UptimekumaIntegration;
}

export type UptimekumaMonitorStatus = "up" | "down" | "pending" | "maintenance";

export interface UptimekumaMonitor {
  id: string;
  name: string;
  status: UptimekumaMonitorStatus;
  type: string;
  url: string | null;
}

export interface UptimekumaSummary {
  total: number;
  up: number;
  down: number;
  pending: number;
  maintenance: number;
}

export interface UptimekumaMonitorsResponse {
  summary: UptimekumaSummary;
  monitors: UptimekumaMonitor[];
  fetched_at: string;
}
