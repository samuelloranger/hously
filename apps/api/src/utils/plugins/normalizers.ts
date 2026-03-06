import type {
  RedditPluginConfig,
  HackernewsPluginConfig,
  JellyfinPluginConfig,
  NetdataPluginConfig,
  ProwlarrPluginConfig,
  RadarrPluginConfig,
  ScrutinyPluginConfig,
  SonarrPluginConfig,
  TmdbPluginConfig,
  TrackerPluginConfig,
  TrackerType,
  WeatherPluginConfig,
} from './types';
import { decrypt } from '../../services/crypto';

const normalizeSecret = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return decrypt(trimmed).trim();
  } catch {
    return trimmed;
  }
};

export const normalizeJellyfinConfig = (config: unknown): JellyfinPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
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

  const apiKey = normalizeSecret(cfg.api_key);
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

  const apiKey = normalizeSecret(cfg.api_key);
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

export const normalizeProwlarrConfig = (config: unknown): ProwlarrPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
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

const DEFAULT_TMDB_POPULARITY_THRESHOLD = 15;

export const normalizeTmdbConfig = (config: unknown): TmdbPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;
  const apiKey = normalizeSecret(cfg.api_key);
  if (!apiKey) return null;
  const rawThreshold =
    typeof cfg.popularity_threshold === 'number' ? cfg.popularity_threshold : DEFAULT_TMDB_POPULARITY_THRESHOLD;
  const popularityThreshold = Math.max(0, Math.min(100, Math.round(rawThreshold)));
  return {
    api_key: apiKey,
    popularity_threshold: popularityThreshold,
  };
};

export const normalizeRedditConfig = (config: unknown): RedditPluginConfig => {
  const defaults: RedditPluginConfig = { subreddits: ['selfhosted', 'homelab'] };
  if (!config || typeof config !== 'object' || Array.isArray(config)) return defaults;
  const cfg = config as Record<string, unknown>;

  if (!Array.isArray(cfg.subreddits) || cfg.subreddits.length === 0) return defaults;

  const valid = (cfg.subreddits as unknown[])
    .filter((s): s is string => typeof s === 'string')
    .map(s => s.replace(/^r\//, '').trim())
    .filter(s => /^[a-zA-Z0-9_]+$/.test(s));

  return { subreddits: valid.length > 0 ? valid : defaults.subreddits };
};

export const normalizeHackernewsConfig = (config: unknown): HackernewsPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const validFeedTypes = ['top', 'best', 'new', 'ask', 'show', 'job'] as const;
  const feedType = validFeedTypes.includes(cfg.feed_type as (typeof validFeedTypes)[number])
    ? (cfg.feed_type as HackernewsPluginConfig['feed_type'])
    : 'top';

  const storyCount =
    typeof cfg.story_count === 'number'
      ? Math.trunc(cfg.story_count)
      : typeof cfg.story_count === 'string'
        ? parseInt(cfg.story_count, 10)
        : 10;

  return {
    feed_type: feedType,
    story_count: Math.max(1, Math.min(storyCount, 50)),
  };
};

export const normalizeTrackerConfig = (type: TrackerType, config: unknown): TrackerPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const flaresolverrUrl = typeof cfg.flaresolverr_url === 'string' ? cfg.flaresolverr_url.trim() : '';
  const trackerUrlRaw = typeof cfg.tracker_url === 'string' ? cfg.tracker_url.trim() : '';
  const username = typeof cfg.username === 'string' ? cfg.username.trim() : '';
  const password = normalizeSecret(cfg.password);

  if (!trackerUrlRaw || !username) return null;

  return {
    flaresolverr_url: flaresolverrUrl ? flaresolverrUrl.replace(/\/+$/, '') : undefined,
    tracker_url: trackerUrlRaw.replace(/\/+$/, ''),
    username,
    password: password || undefined,
  };
};
