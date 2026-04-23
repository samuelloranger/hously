export interface JellyfinIntegrationConfig {
  api_key: string;
  website_url: string;
}

export interface RadarrIntegrationConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
}

export interface SonarrIntegrationConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

/** Shared config shape for indexer managers (Prowlarr, Jackett). */
export interface IndexerIntegrationConfig {
  api_key: string;
  website_url: string;
}

/** @deprecated Use IndexerIntegrationConfig — kept as alias for existing references. */
export type ProwlarrIntegrationConfig = IndexerIntegrationConfig;

export interface ScrutinyIntegrationConfig {
  website_url: string;
}

export interface BeszelIntegrationConfig {
  website_url: string;
  email: string;
  password: string;
}

export interface AdguardIntegrationConfig {
  website_url: string;
  username: string;
  password: string;
}

export interface WeatherIntegrationConfig {
  address: string;
  temperature_unit: "fahrenheit" | "celsius";
}

export interface TmdbIntegrationConfig {
  api_key: string;
  popularity_threshold: number;
}

export interface NetdataIntegrationConfig {
  website_url: string;
}

export type TrackerType = "c411" | "torr9" | "la-cale";

export interface TrackerIntegrationConfig {
  flaresolverr_url?: string;
  tracker_url: string;
  username: string;
  password?: string;
}

export interface HomeAssistantIntegrationConfig {
  base_url: string;
  access_token: string;
  /** Entity IDs allowed on the home dashboard widget (subset of `light.*` and `switch.*`). */
  enabled_entity_ids: string[];
}

export interface UptimekumaIntegrationConfig {
  website_url: string;
  api_key: string;
}
