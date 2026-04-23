import type {
  AdguardIntegrationConfig,
  JellyfinIntegrationConfig,
  BeszelIntegrationConfig,
  IndexerIntegrationConfig,
  NetdataIntegrationConfig,
  ProwlarrIntegrationConfig,
  RadarrIntegrationConfig,
  ScrutinyIntegrationConfig,
  SonarrIntegrationConfig,
  TmdbIntegrationConfig,
  TrackerIntegrationConfig,
  UptimekumaIntegrationConfig,
  WeatherIntegrationConfig,
  HomeAssistantIntegrationConfig,
} from "./types";
import { decrypt } from "@hously/api/services/crypto";
import { isValidHttpUrl } from "./utils";
import { haDomainFromEntityId, normalizeHaBaseUrl } from "./homeAssistantUtils";

const normalizeSecret = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return decrypt(trimmed).trim();
  } catch {
    return trimmed;
  }
};

export const normalizeJellyfinConfig = (
  config: unknown,
): JellyfinIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

export const normalizeRadarrConfig = (
  config: unknown,
): RadarrIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  const rootFolderPath =
    typeof cfg.root_folder_path === "string" ? cfg.root_folder_path.trim() : "";
  const qualityProfileId =
    typeof cfg.quality_profile_id === "number"
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === "string"
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;

  if (
    !apiKey ||
    !websiteUrl ||
    !rootFolderPath ||
    !Number.isFinite(qualityProfileId) ||
    qualityProfileId <= 0
  ) {
    return null;
  }

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
  };
};

export const normalizeSonarrConfig = (
  config: unknown,
): SonarrIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  const rootFolderPath =
    typeof cfg.root_folder_path === "string" ? cfg.root_folder_path.trim() : "";
  const qualityProfileId =
    typeof cfg.quality_profile_id === "number"
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === "string"
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;
  const languageProfileId =
    typeof cfg.language_profile_id === "number"
      ? Math.trunc(cfg.language_profile_id)
      : typeof cfg.language_profile_id === "string"
        ? parseInt(cfg.language_profile_id, 10)
        : Number.NaN;

  if (
    !apiKey ||
    !websiteUrl ||
    !rootFolderPath ||
    !Number.isFinite(qualityProfileId) ||
    qualityProfileId <= 0 ||
    !Number.isFinite(languageProfileId) ||
    languageProfileId <= 0
  ) {
    return null;
  }

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
    language_profile_id: languageProfileId,
  };
};

export const normalizeProwlarrConfig = (
  config: unknown,
): ProwlarrIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

export const normalizeJackettConfig = (
  config: unknown,
): IndexerIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

export const normalizeScrutinyConfig = (
  config: unknown,
): ScrutinyIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  if (!websiteUrl) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};

export const normalizeBeszelConfig = (
  config: unknown,
): BeszelIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  const email = typeof cfg.email === "string" ? cfg.email.trim() : "";
  const password =
    typeof cfg.password === "string" ? normalizeSecret(cfg.password) : "";
  if (!websiteUrl || !email || !password) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
    email,
    password,
  };
};

export const normalizeAdguardConfig = (
  config: unknown,
): AdguardIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  const username = typeof cfg.username === "string" ? cfg.username.trim() : "";
  const password = normalizeSecret(cfg.password);
  if (!websiteUrl || !username || !password) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
    username,
    password,
  };
};

export const normalizeWeatherConfig = (
  config: unknown,
): WeatherIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const address = typeof cfg.address === "string" ? cfg.address.trim() : "";
  const temperatureUnit =
    cfg.temperature_unit === "celsius" ? "celsius" : "fahrenheit";

  if (!address) return null;
  return {
    address,
    temperature_unit: temperatureUnit,
  };
};

const DEFAULT_TMDB_POPULARITY_THRESHOLD = 15;

export const normalizeTmdbConfig = (
  config: unknown,
): TmdbIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const apiKey = normalizeSecret(cfg.api_key);
  if (!apiKey) return null;
  const rawThreshold =
    typeof cfg.popularity_threshold === "number"
      ? cfg.popularity_threshold
      : DEFAULT_TMDB_POPULARITY_THRESHOLD;
  const popularityThreshold = Math.max(
    0,
    Math.min(100, Math.round(rawThreshold)),
  );
  return {
    api_key: apiKey,
    popularity_threshold: popularityThreshold,
  };
};

export const normalizeNetdataConfig = (
  config: unknown,
): NetdataIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";
  if (!websiteUrl) return null;
  return { website_url: websiteUrl.replace(/\/+$/, "") };
};

export const normalizeTrackerConfig = (
  config: unknown,
): TrackerIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const flaresolverrUrl =
    typeof cfg.flaresolverr_url === "string" ? cfg.flaresolverr_url.trim() : "";
  const trackerUrlRaw =
    typeof cfg.tracker_url === "string" ? cfg.tracker_url.trim() : "";
  const username = typeof cfg.username === "string" ? cfg.username.trim() : "";
  const password = normalizeSecret(cfg.password);
  if (!trackerUrlRaw || !username) return null;

  return {
    flaresolverr_url: flaresolverrUrl
      ? flaresolverrUrl.replace(/\/+$/, "")
      : undefined,
    tracker_url: trackerUrlRaw.replace(/\/+$/, ""),
    username,
    password: password || undefined,
  };
};

export const normalizeHomeAssistantConfig = (
  config: unknown,
): HomeAssistantIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const baseUrlRaw =
    typeof cfg.base_url === "string" ? cfg.base_url.trim() : "";
  const baseUrl = normalizeHaBaseUrl(baseUrlRaw);
  const accessToken = normalizeSecret(cfg.access_token);
  if (!baseUrl || !isValidHttpUrl(baseUrl) || !accessToken) return null;

  const rawIds = Array.isArray(cfg.enabled_entity_ids)
    ? cfg.enabled_entity_ids
    : [];
  const enabledEntityIds = [
    ...new Set(
      rawIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  ].filter((id) => haDomainFromEntityId(id) !== null);

  return {
    base_url: baseUrl,
    access_token: accessToken,
    enabled_entity_ids: enabledEntityIds,
  };
};

export const normalizeUptimekumaConfig = (
  config: unknown,
): UptimekumaIntegrationConfig | null => {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};
