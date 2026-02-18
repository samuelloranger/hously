import type {
  JellyfinPluginConfig,
  NetdataPluginConfig,
  RadarrPluginConfig,
  ScrutinyPluginConfig,
  SonarrPluginConfig,
  WeatherPluginConfig,
  YggPluginConfig,
} from './types';

export const normalizeJellyfinConfig = (config: unknown): JellyfinPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

export const normalizeRadarrConfig = (config: unknown): RadarrPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  const rootFolderPath = typeof cfg.root_folder_path === 'string' ? cfg.root_folder_path.trim() : '';
  const qualityProfileId =
    typeof cfg.quality_profile_id === 'number'
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === 'string'
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;

  if (!apiKey || !websiteUrl || !rootFolderPath || !Number.isFinite(qualityProfileId) || qualityProfileId <= 0) {
    return null;
  }

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
  };
};

export const normalizeSonarrConfig = (config: unknown): SonarrPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  const rootFolderPath = typeof cfg.root_folder_path === 'string' ? cfg.root_folder_path.trim() : '';
  const qualityProfileId =
    typeof cfg.quality_profile_id === 'number'
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === 'string'
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;
  const languageProfileId =
    typeof cfg.language_profile_id === 'number'
      ? Math.trunc(cfg.language_profile_id)
      : typeof cfg.language_profile_id === 'string'
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
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
    language_profile_id: languageProfileId,
  };
};

export const normalizeScrutinyConfig = (config: unknown): ScrutinyPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  if (!websiteUrl) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

export const normalizeNetdataConfig = (config: unknown): NetdataPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  if (!websiteUrl) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

export const normalizeWeatherConfig = (config: unknown): WeatherPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;
  const address = typeof cfg.address === 'string' ? cfg.address.trim() : '';
  const temperatureUnit = cfg.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit';

  if (!address) return null;
  return {
    address,
    temperature_unit: temperatureUnit,
  };
};

export const normalizeYggConfig = (config: unknown): YggPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const flaresolverrUrl = typeof cfg.flaresolverr_url === 'string' ? cfg.flaresolverr_url.trim() : '';
  const yggUrl = typeof cfg.ygg_url === 'string' ? cfg.ygg_url.trim() : '';
  const username = typeof cfg.username === 'string' ? cfg.username.trim() : '';
  const password = typeof cfg.password === 'string' ? cfg.password : '';

  if (!yggUrl || !username) return null;

  return {
    flaresolverr_url: flaresolverrUrl ? flaresolverrUrl.replace(/\/+$/, '') : undefined,
    ygg_url: yggUrl.replace(/\/+$/, ''),
    username,
    password: password || undefined,
  };
};
