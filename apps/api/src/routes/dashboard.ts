import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso } from '../utils';
import { getJsonCache, setJsonCache } from '../services/cache';
import {
  buildQbittorrentDisabledSnapshot,
  fetchQbittorrentSnapshot,
  normalizeQbittorrentConfig,
  type QbittorrentDashboardSnapshot,
} from '../services/qbittorrentService';

export interface JellyfinLatestItem {
  id: string;
  title: string;
  subtitle: string | null;
  item_url: string | null;
  banner_url: string | null;
  poster_url: string | null;
  item_type: string | null;
  year: number | null;
  added_at: string | null;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tv';
  release_date: string | null;
  poster_url: string | null;
  tmdb_url: string;
  providers: DashboardUpcomingProvider[];
}

interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

interface ArrPluginStatus {
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
}

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

interface RadarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
}

interface SonarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

interface ScrutinyPluginConfig {
  website_url: string;
}

interface DashboardScrutinyDrive {
  id: string;
  model_name: string | null;
  serial_number: string | null;
  capacity_bytes: number | null;
  device_status: number | null;
  temperature_c: number | null;
  power_on_hours: number | null;
  firmware: string | null;
  form_factor: string | null;
  updated_at: string | null;
}

interface DashboardScrutinySummary {
  total_drives: number;
  healthy_drives: number;
  warning_drives: number;
  avg_temp_c: number | null;
  hottest_temp_c: number | null;
}

interface DashboardScrutinySummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: DashboardScrutinySummary;
  drives: DashboardScrutinyDrive[];
  error?: string;
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const toYearOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(entry => toStringOrNull(entry)).filter((entry): entry is string => Boolean(entry));
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeJellyfinConfig = (config: unknown): JellyfinPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!apiKey || !websiteUrl) return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

const toPositiveIntOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const normalizeRadarrConfig = (config: unknown): RadarrPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  const rootFolderPath = toStringOrNull(cfg.root_folder_path);
  const qualityProfileId = toPositiveIntOrNull(cfg.quality_profile_id);
  if (!apiKey || !websiteUrl || !rootFolderPath || !qualityProfileId) return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
  };
};

const normalizeSonarrConfig = (config: unknown): SonarrPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  const rootFolderPath = toStringOrNull(cfg.root_folder_path);
  const qualityProfileId = toPositiveIntOrNull(cfg.quality_profile_id);
  const languageProfileId = toPositiveIntOrNull(cfg.language_profile_id);
  if (!apiKey || !websiteUrl || !rootFolderPath || !qualityProfileId || !languageProfileId) return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
    language_profile_id: languageProfileId,
  };
};

const normalizeScrutinyConfig = (config: unknown): ScrutinyPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!websiteUrl) return null;

  return {
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const TMDB_PROVIDER_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_WEB_BASE_URL = 'https://www.themoviedb.org';
const TMDB_UPCOMING_CACHE_TTL_SECONDS = 24 * 60 * 60;

const getArrPluginStatus = async (): Promise<ArrPluginStatus> => {
  const [radarrPlugin, sonarrPlugin] = await Promise.all([
    prisma.plugin.findFirst({
      where: { type: 'radarr' },
      select: { enabled: true },
    }),
    prisma.plugin.findFirst({
      where: { type: 'sonarr' },
      select: { enabled: true },
    }),
  ]);

  return {
    radarr_enabled: Boolean(radarrPlugin?.enabled),
    sonarr_enabled: Boolean(sonarrPlugin?.enabled),
  };
};

const toIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const mapTmdbItem = (rawItem: unknown, mediaType: 'movie' | 'tv'): DashboardUpcomingItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const numericId = typeof item.id === 'number' && Number.isFinite(item.id) ? Math.trunc(item.id) : null;
  if (!numericId) return null;

  const title = toStringOrNull(item.title) || toStringOrNull(item.name);
  if (!title) return null;

  const releaseDate =
    toStringOrNull(item.release_date) || toStringOrNull(item.first_air_date) || toStringOrNull(item.air_date);
  const posterPath = toStringOrNull(item.poster_path);

  return {
    id: `${mediaType}-${numericId}`,
    title,
    media_type: mediaType,
    release_date: releaseDate,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : null,
    tmdb_url: `${TMDB_WEB_BASE_URL}/${mediaType}/${numericId}`,
    providers: [],
  };
};

const parseTmdbNumericId = (itemId: string): number | null => {
  const [, numericPart] = itemId.split('-', 2);
  const numericId = numericPart ? parseInt(numericPart, 10) : Number.NaN;
  return Number.isFinite(numericId) ? numericId : null;
};

const fetchTmdbDiscoverPage = async (
  mediaType: 'movie' | 'tv',
  page: number,
  tmdbApiKey: string,
  todayIso: string,
  oneYearOutIso: string
): Promise<{ items: DashboardUpcomingItem[]; totalPages: number } | null> => {
  const endpoint = mediaType === 'movie' ? 'discover/movie' : 'discover/tv';
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set('api_key', tmdbApiKey);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', String(page));

  if (mediaType === 'movie') {
    url.searchParams.set('sort_by', 'primary_release_date.asc');
    url.searchParams.set('region', 'US');
    url.searchParams.set('release_date.gte', todayIso);
    url.searchParams.set('release_date.lte', oneYearOutIso);
    url.searchParams.set('with_release_type', '4');
    url.searchParams.set('with_original_language', 'en');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('include_video', 'false');
  } else {
    url.searchParams.set('sort_by', 'first_air_date.asc');
    url.searchParams.set('first_air_date.gte', todayIso);
    url.searchParams.set('first_air_date.lte', oneYearOutIso);
    url.searchParams.set('include_null_first_air_dates', 'false');
    url.searchParams.set('with_origin_country', 'US');
    url.searchParams.set('with_original_language', 'en');
  }

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results : [];
  const totalPagesRaw = typeof data.total_pages === 'number' ? Math.trunc(data.total_pages) : 1;
  const totalPages = Math.max(1, Number.isFinite(totalPagesRaw) ? totalPagesRaw : 1);

  const items = results
    .map(item => mapTmdbItem(item, mediaType))
    .filter((item): item is DashboardUpcomingItem => !!item);

  return { items, totalPages };
};

const collectTmdbUpcoming = async (
  mediaType: 'movie' | 'tv',
  requiredCount: number,
  tmdbApiKey: string,
  todayIso: string,
  oneYearOutIso: string
): Promise<{ items: DashboardUpcomingItem[]; hasMore: boolean } | null> => {
  const items: DashboardUpcomingItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (items.length < requiredCount && page <= totalPages) {
    const response = await fetchTmdbDiscoverPage(mediaType, page, tmdbApiKey, todayIso, oneYearOutIso);
    if (!response) return null;
    items.push(...response.items);
    totalPages = response.totalPages;
    page += 1;
  }

  return { items, hasMore: page <= totalPages };
};

const getQbittorrentSnapshot = async (): Promise<QbittorrentDashboardSnapshot> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'qbittorrent' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildQbittorrentDisabledSnapshot();
  }

  const config = normalizeQbittorrentConfig(plugin.config);
  if (!config) {
    const disabled = buildQbittorrentDisabledSnapshot('qBittorrent plugin is enabled but not configured');
    return { ...disabled, enabled: true };
  }

  return fetchQbittorrentSnapshot(config, true);
};

const buildScrutinyDisabledSummary = (error?: string): DashboardScrutinySummaryResponse => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
  summary: {
    total_drives: 0,
    healthy_drives: 0,
    warning_drives: 0,
    avg_temp_c: null,
    hottest_temp_c: null,
  },
  drives: [],
  ...(error ? { error } : {}),
});

const fetchScrutinySummary = async (): Promise<DashboardScrutinySummaryResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'scrutiny' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildScrutinyDisabledSummary();
  }

  const config = normalizeScrutinyConfig(plugin.config);
  if (!config) {
    return {
      ...buildScrutinyDisabledSummary('Scrutiny plugin is enabled but not configured'),
      enabled: true,
    };
  }

  try {
    const summaryUrl = new URL('/api/summary', config.website_url);
    const response = await fetch(summaryUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ...buildScrutinyDisabledSummary(`Scrutiny request failed with status ${response.status}`),
        enabled: true,
      };
    }

    const payload = (await response.json()) as unknown;
    const root = toRecord(payload);
    const data = toRecord(root?.data);
    const summaryRecord = toRecord(data?.summary);

    if (!summaryRecord) {
      return {
        ...buildScrutinyDisabledSummary('Invalid Scrutiny summary payload'),
        enabled: true,
      };
    }

    const drives = Object.entries(summaryRecord)
      .map(([id, raw]) => {
        const entry = toRecord(raw);
        if (!entry) return null;
        const device = toRecord(entry.device);
        const smart = toRecord(entry.smart);

        const statusRaw = toNumberOrNull(device?.device_status);
        const status = statusRaw == null ? null : Math.trunc(statusRaw);
        const temperatureRaw = toNumberOrNull(smart?.temp);
        const powerOnHoursRaw = toNumberOrNull(smart?.power_on_hours);
        const capacityRaw = toNumberOrNull(device?.capacity);

        const drive: DashboardScrutinyDrive = {
          id,
          model_name: toStringOrNull(device?.model_name),
          serial_number: toStringOrNull(device?.serial_number),
          capacity_bytes: capacityRaw == null ? null : Math.trunc(capacityRaw),
          device_status: status,
          temperature_c: temperatureRaw == null ? null : Math.round(temperatureRaw * 10) / 10,
          power_on_hours: powerOnHoursRaw == null ? null : Math.trunc(powerOnHoursRaw),
          firmware: toStringOrNull(device?.firmware),
          form_factor: toStringOrNull(device?.form_factor),
          updated_at: toStringOrNull(device?.UpdatedAt),
        };

        return drive;
      })
      .filter((drive): drive is DashboardScrutinyDrive => Boolean(drive))
      .sort((a, b) => {
        if (a.temperature_c == null && b.temperature_c == null) return 0;
        if (a.temperature_c == null) return 1;
        if (b.temperature_c == null) return -1;
        return b.temperature_c - a.temperature_c;
      });

    const totalDrives = drives.length;
    const healthyDrives = drives.filter(drive => drive.device_status === 0).length;
    const warningDrives = drives.filter(drive => drive.device_status != null && drive.device_status !== 0).length;
    const temperatures = drives.map(drive => drive.temperature_c).filter((temp): temp is number => temp != null);
    const avgTemp =
      temperatures.length > 0
        ? Math.round((temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length) * 10) / 10
        : null;
    const hottestTemp = temperatures.length > 0 ? Math.max(...temperatures) : null;
    const updatedAt =
      drives.map(drive => drive.updated_at).find((value): value is string => Boolean(value)) ??
      new Date().toISOString();

    return {
      enabled: true,
      connected: true,
      updated_at: updatedAt,
      summary: {
        total_drives: totalDrives,
        healthy_drives: healthyDrives,
        warning_drives: warningDrives,
        avg_temp_c: avgTemp,
        hottest_temp_c: hottestTemp,
      },
      drives,
    };
  } catch (error) {
    console.error('Error fetching Scrutiny summary:', error);
    return {
      ...buildScrutinyDisabledSummary('Failed to fetch Scrutiny summary'),
      enabled: true,
    };
  }
};

const fetchTmdbProviders = async (
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  tmdbApiKey: string
): Promise<DashboardUpcomingProvider[]> => {
  try {
    const providersUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`);
    providersUrl.searchParams.set('api_key', tmdbApiKey);
    const response = await fetch(providersUrl.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];

    const data = (await response.json()) as Record<string, unknown>;
    const results = toRecord(data.results);
    const us = toRecord(results?.US);
    if (!us) return [];

    const categoryOrder = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
    const selected: DashboardUpcomingProvider[] = [];
    const seen = new Set<number>();

    for (const category of categoryOrder) {
      const entries = Array.isArray(us[category]) ? us[category] : [];
      for (const rawProvider of entries) {
        const provider = toRecord(rawProvider);
        if (!provider) continue;

        const providerId = typeof provider.provider_id === 'number' ? Math.trunc(provider.provider_id) : null;
        const providerName = toStringOrNull(provider.provider_name);
        const logoPath = toStringOrNull(provider.logo_path);
        if (!providerId || !providerName || !logoPath || seen.has(providerId)) continue;

        selected.push({
          id: providerId,
          name: providerName,
          logo_url: `${TMDB_PROVIDER_LOGO_BASE_URL}${logoPath}`,
        });
        seen.add(providerId);

        if (selected.length >= 4) return selected;
      }
    }

    return selected;
  } catch {
    return [];
  }
};

const mapJellyfinApiItem = (rawItem: unknown, jellyfinWebsiteUrl: string): JellyfinLatestItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const itemType = toStringOrNull(item.Type);
  const itemName = toStringOrNull(item.Name);
  const seriesName = toStringOrNull(item.SeriesName);
  const albumName = toStringOrNull(item.Album);

  // For TV episodes, prioritize series name as main title and episode name as subtitle.
  const isEpisode = itemType?.toLowerCase() === 'episode';
  const title = isEpisode ? seriesName || itemName || albumName : itemName || seriesName || albumName;
  const subtitle = isEpisode ? itemName || null : null;
  if (!title) return null;

  const sourceItemId = toStringOrNull(item.Id);
  const id = sourceItemId || `${title}-${itemType || 'item'}`;
  const year = toYearOrNull(item.ProductionYear) || toYearOrNull(item.Year) || null;
  const addedAt = toStringOrNull(item.DateCreated);
  const parentBackdropItemId = toStringOrNull(item.ParentBackdropItemId);
  const backdropTag = toStringArray(item.BackdropImageTags)[0] || null;
  const parentBackdropTag = toStringArray(item.ParentBackdropImageTags)[0] || null;
  const imageTags = toRecord(item.ImageTags);
  const primaryTag = toStringOrNull(imageTags?.Primary);
  const itemUrl = sourceItemId
    ? `${jellyfinWebsiteUrl}/web/index.html#!/details?id=${encodeURIComponent(sourceItemId)}`
    : null;
  const bannerUrl = sourceItemId
    ? (() => {
        const params = new URLSearchParams({ itemId: sourceItemId, preferred: 'backdrop' });
        if (parentBackdropItemId) params.set('parentBackdropItemId', parentBackdropItemId);
        if (backdropTag) params.set('backdropTag', backdropTag);
        if (parentBackdropTag) params.set('parentBackdropTag', parentBackdropTag);
        if (primaryTag) params.set('primaryTag', primaryTag);
        return `/api/dashboard/jellyfin/image?${params.toString()}`;
      })()
    : null;
  const posterUrl = sourceItemId
    ? (() => {
        const params = new URLSearchParams({ itemId: sourceItemId, preferred: 'primary' });
        if (primaryTag) params.set('primaryTag', primaryTag);
        return `/api/dashboard/jellyfin/image?${params.toString()}`;
      })()
    : null;

  return {
    id,
    title,
    subtitle,
    item_url: itemUrl,
    banner_url: bannerUrl,
    poster_url: posterUrl,
    item_type: itemType,
    year,
    added_at: addedAt,
  };
};

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .use(auth)
  .get('/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      // Get today's range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 1. Events today (for current user only)
      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user.id,
          startDatetime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // 2. Shopping Items (incomplete, not deleted)
      const shoppingCount = await prisma.shoppingItem.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
          deletedAt: null,
        },
      });

      // 3. Chores (incomplete)
      const choresCount = await prisma.chore.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
        },
      });

      // 4. Monthly total (tasks completed this month)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyTotal = await prisma.taskCompletion.count({
        where: {
          completedAt: { gte: startOfMonth },
        },
      });

      return {
        stats: {
          events_today: eventsTodayCount,
          shopping_count: shoppingCount,
          chores_count: choresCount,
          monthly_total: monthlyTotal,
        },
        activities: [],
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      set.status = 500;
      return { error: 'Failed to get dashboard stats' };
    }
  })
  .get(
    '/activities',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 5;

        // Get recent task completions with user info
        const recentCompletions = await prisma.taskCompletion.findMany({
          orderBy: { completedAt: 'desc' },
          take: limit,
          include: {
            user: {
              select: {
                firstName: true,
                email: true,
              },
            },
          },
        });

        const activities = recentCompletions.map(completion => ({
          id: completion.id,
          user_id: completion.userId,
          task_type: completion.taskType,
          task_id: completion.taskId,
          completed_at: formatIso(completion.completedAt),
          task_name: completion.taskName,
          emotion: completion.emotion,
          username: completion.user?.firstName || completion.user?.email || 'Unknown',
        }));

        return { activities };
      } catch (error) {
        console.error('Error getting dashboard activities:', error);
        set.status = 500;
        return { error: 'Failed to get dashboard activities' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/upcoming',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const arrPluginStatus = await getArrPluginStatus();
        const tmdbApiKey = process.env.TMDB_API_KEY?.trim();
        const requestedPage = toPositiveInt(query.page, 1);
        const page = Math.max(1, Math.min(100, requestedPage));
        const requestedLimit = toPositiveInt(query.limit, 8);
        const limit = Math.max(1, Math.min(24, requestedLimit));

        if (!tmdbApiKey) {
          return { enabled: false, items: [], page, limit, has_more: false, ...arrPluginStatus };
        }

        const today = new Date();
        const todayIso = toIsoDate(today);
        const oneYearOut = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
        const oneYearOutIso = toIsoDate(oneYearOut);
        const cacheKey = `dashboard:tmdb:upcoming:v3:page:${page}:limit:${limit}:from:${todayIso}`;

        if (process.env.NODE_ENV === 'production') {
          const cached = await getJsonCache<{
            enabled: boolean;
            items: DashboardUpcomingItem[];
            page: number;
            limit: number;
            has_more: boolean;
          }>(cacheKey);
          if (cached) {
            return { ...cached, ...arrPluginStatus };
          }
        }

        const requiredCount = page * limit;
        const [moviesResult, tvResult] = await Promise.all([
          collectTmdbUpcoming('movie', requiredCount, tmdbApiKey, todayIso, oneYearOutIso),
          collectTmdbUpcoming('tv', requiredCount, tmdbApiKey, todayIso, oneYearOutIso),
        ]);

        if (!moviesResult || !tvResult) {
          set.status = 502;
          return { error: 'TMDB request failed' };
        }

        const merged = [...moviesResult.items.slice(0, requiredCount), ...tvResult.items.slice(0, requiredCount)]
          .filter(item => {
            if (!item.release_date) return false;
            const releaseTime = Date.parse(item.release_date);
            const todayTime = Date.parse(todayIso);
            const oneYearOutTime = Date.parse(oneYearOutIso);
            return Number.isFinite(releaseTime) && releaseTime >= todayTime && releaseTime <= oneYearOutTime;
          })
          .sort((a, b) => {
            const aTime = a.release_date ? Date.parse(a.release_date) : Number.POSITIVE_INFINITY;
            const bTime = b.release_date ? Date.parse(b.release_date) : Number.POSITIVE_INFINITY;
            return aTime - bTime;
          });

        const offset = (page - 1) * limit;
        const pageSlice = merged.slice(offset, offset + limit);
        const hasMore = merged.length > offset + limit || moviesResult.hasMore || tvResult.hasMore;

        const itemsWithProviders = await Promise.all(
          pageSlice.map(async item => {
            const tmdbId = parseTmdbNumericId(item.id);
            if (!tmdbId) return item;

            const providers = await fetchTmdbProviders(item.media_type, tmdbId, tmdbApiKey);
            return {
              ...item,
              providers,
            };
          })
        );

        const responsePayload = { enabled: true, items: itemsWithProviders, page, limit, has_more: hasMore };
        if (process.env.NODE_ENV === 'production') {
          await setJsonCache(cacheKey, responsePayload, TMDB_UPCOMING_CACHE_TTL_SECONDS);
        }
        return { ...responsePayload, ...arrPluginStatus };
      } catch (error) {
        console.error('Error getting TMDB upcoming items:', error);
        set.status = 500;
        return { error: 'Failed to get TMDB upcoming items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        page: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/upcoming/add',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { media_type: mediaType, tmdb_id: tmdbId } = body;
      const searchOnAdd = body.search_on_add ?? true;

      try {
        if (mediaType === 'movie') {
          const radarrPlugin = await prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          });

          if (!radarrPlugin?.enabled) {
            set.status = 400;
            return { error: 'Radarr plugin is not enabled' };
          }

          const config = normalizeRadarrConfig(radarrPlugin.config);
          if (!config) {
            set.status = 400;
            return { error: 'Radarr plugin is not configured' };
          }

          const lookupUrl = new URL('/api/v3/movie/lookup/tmdb', config.website_url);
          lookupUrl.searchParams.set('tmdbId', String(tmdbId));
          const lookupResponse = await fetch(lookupUrl.toString(), {
            headers: { 'X-Api-Key': config.api_key, Accept: 'application/json' },
          });

          if (!lookupResponse.ok) {
            set.status = 502;
            return { error: 'Radarr lookup failed' };
          }

          const lookupData = (await lookupResponse.json()) as Record<string, unknown> | Record<string, unknown>[];
          const movieRecord = Array.isArray(lookupData) ? lookupData[0] : lookupData;
          const movie = toRecord(movieRecord);
          if (!movie) {
            set.status = 404;
            return { error: 'Movie not found in Radarr lookup' };
          }

          const payload = {
            ...movie,
            qualityProfileId: config.quality_profile_id,
            rootFolderPath: config.root_folder_path,
            monitored: true,
            addOptions: {
              searchForMovie: searchOnAdd,
            },
          };

          const addUrl = new URL('/api/v3/movie', config.website_url);
          const addResponse = await fetch(addUrl.toString(), {
            method: 'POST',
            headers: {
              'X-Api-Key': config.api_key,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (addResponse.status === 409) {
            return {
              success: true,
              service: 'radarr',
              added: false,
              already_exists: true,
            };
          }

          if (!addResponse.ok) {
            const debugText = await addResponse.text().catch(() => null);
            console.error('Failed to add movie to Radarr', {
              status: addResponse.status,
              tmdbId,
              payload: (payload as any).title || (payload as any).tmdbId || payload,
              body: debugText,
            });
            set.status = 502;
            return { error: 'Failed to add movie to Radarr' };
          }

          return {
            success: true,
            service: 'radarr',
            added: true,
            already_exists: false,
          };
        }

        const sonarrPlugin = await prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        });

        if (!sonarrPlugin?.enabled) {
          set.status = 400;
          return { error: 'Sonarr plugin is not enabled' };
        }

        const config = normalizeSonarrConfig(sonarrPlugin.config);
        if (!config) {
          set.status = 400;
          return { error: 'Sonarr plugin is not configured' };
        }

        const lookupUrl = new URL('/api/v3/series/lookup', config.website_url);
        lookupUrl.searchParams.set('term', `tmdb:${tmdbId}`);
        const lookupResponse = await fetch(lookupUrl.toString(), {
          headers: { 'X-Api-Key': config.api_key, Accept: 'application/json' },
        });

        if (!lookupResponse.ok) {
          set.status = 502;
          return { error: 'Sonarr lookup failed' };
        }

        const lookupData = (await lookupResponse.json()) as unknown[];
        const firstMatch = Array.isArray(lookupData) ? toRecord(lookupData[0]) : null;
        if (!firstMatch) {
          set.status = 404;
          return { error: 'Series not found in Sonarr lookup' };
        }

        const payload = {
          ...firstMatch,
          qualityProfileId: config.quality_profile_id,
          languageProfileId: config.language_profile_id,
          rootFolderPath: config.root_folder_path,
          monitored: true,
          addOptions: {
            searchForMissingEpisodes: searchOnAdd,
          },
        };

        const addUrl = new URL('/api/v3/series', config.website_url);
        const addResponse = await fetch(addUrl.toString(), {
          method: 'POST',
          headers: {
            'X-Api-Key': config.api_key,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (addResponse.status === 409) {
          return {
            success: true,
            service: 'sonarr',
            added: false,
            already_exists: true,
          };
        }

        if (!addResponse.ok) {
          set.status = 502;
          return { error: 'Failed to add series to Sonarr' };
        }

        return {
          success: true,
          service: 'sonarr',
          added: true,
          already_exists: false,
        };
      } catch (error) {
        console.error('Error adding upcoming item to *arr:', error);
        set.status = 500;
        return { error: 'Failed to add upcoming item' };
      }
    },
    {
      body: t.Object({
        media_type: t.Union([t.Literal('movie'), t.Literal('tv')]),
        tmdb_id: t.Numeric(),
        search_on_add: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    '/upcoming/status',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { media_type: mediaType, tmdb_id: tmdbId } = body;

      try {
        if (mediaType === 'movie') {
          const radarrPlugin = await prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          });

          if (!radarrPlugin?.enabled) {
            return { exists: false, service: 'radarr' };
          }

          const config = normalizeRadarrConfig(radarrPlugin.config);
          if (!config) {
            return { exists: false, service: 'radarr' };
          }

          const movieUrl = new URL('/api/v3/movie', config.website_url);
          movieUrl.searchParams.set('tmdbId', String(tmdbId));
          const movieResponse = await fetch(movieUrl.toString(), {
            headers: { 'X-Api-Key': config.api_key, Accept: 'application/json' },
          });

          if (!movieResponse.ok) {
            set.status = 502;
            return { error: 'Radarr movie lookup failed' };
          }

          const movieData = (await movieResponse.json()) as unknown[];
          return { exists: Array.isArray(movieData) && movieData.length > 0, service: 'radarr' };
        }

        const sonarrPlugin = await prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        });

        if (!sonarrPlugin?.enabled) {
          return { exists: false, service: 'sonarr' };
        }

        const config = normalizeSonarrConfig(sonarrPlugin.config);
        if (!config) {
          return { exists: false, service: 'sonarr' };
        }

        const seriesUrl = new URL('/api/v3/series', config.website_url);
        seriesUrl.searchParams.set('tmdbId', String(tmdbId));
        const seriesResponse = await fetch(seriesUrl.toString(), {
          headers: { 'X-Api-Key': config.api_key, Accept: 'application/json' },
        });

        if (!seriesResponse.ok) {
          set.status = 502;
          return { error: 'Sonarr series lookup failed' };
        }

        const seriesData = (await seriesResponse.json()) as unknown[];
        return { exists: Array.isArray(seriesData) && seriesData.length > 0, service: 'sonarr' };
      } catch (error) {
        console.error('Error checking upcoming item status', error);
        set.status = 500;
        return { error: 'Failed to check upcoming item status' };
      }
    },
    {
      body: t.Object({
        media_type: t.Union([t.Literal('movie'), t.Literal('tv')]),
        tmdb_id: t.Numeric(),
      }),
    }
  )
  .get('/qbittorrent/status', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getQbittorrentSnapshot();
    } catch (error) {
      console.error('Error fetching qBittorrent status:', error);
      set.status = 500;
      return { error: 'Failed to get qBittorrent status' };
    }
  })
  .get('/scrutiny/summary', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await fetchScrutinySummary();
    } catch (error) {
      console.error('Error fetching Scrutiny summary:', error);
      set.status = 500;
      return { error: 'Failed to get Scrutiny summary' };
    }
  })
  .get('/qbittorrent/stream', async ({ user, set, request }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let pollTimeout: ReturnType<typeof setTimeout> | null = null;
        let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
        let previousPayload = '';

        const closeStream = () => {
          if (closed) return;
          closed = true;
          if (pollTimeout) clearTimeout(pollTimeout);
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          try {
            controller.close();
          } catch {
            // Stream may already be closed by the runtime.
          }
        };

        const writeChunk = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closeStream();
          }
        };

        const scheduleHeartbeat = () => {
          if (closed) return;
          heartbeatTimeout = setTimeout(() => {
            writeChunk(': ping\n\n');
            scheduleHeartbeat();
          }, 15000);
        };

        const poll = async () => {
          if (closed) return;

          try {
            const snapshot = await getQbittorrentSnapshot();
            const payload = JSON.stringify(snapshot);
            if (payload !== previousPayload) {
              previousPayload = payload;
              writeChunk(`data: ${payload}\n\n`);
            }

            const nextMs = Math.max(1000, snapshot.poll_interval_seconds * 1000);
            pollTimeout = setTimeout(() => {
              void poll();
            }, nextMs);
          } catch (error) {
            const fallbackPayload = JSON.stringify({
              ...buildQbittorrentDisabledSnapshot('Failed to refresh qBittorrent status'),
              enabled: true,
              connected: false,
            });
            writeChunk(`data: ${fallbackPayload}\n\n`);
            pollTimeout = setTimeout(() => {
              void poll();
            }, 5000);
            console.error('qBittorrent stream poll error:', error);
          }
        };

        signal.addEventListener('abort', closeStream);

        writeChunk('retry: 3000\n\n');
        scheduleHeartbeat();
        void poll();
      },
      cancel() {
        // No-op: timers are tied to request abort and internal stream closure.
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  })
  .get(
    '/jellyfin/image',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          set.status = 404;
          return { error: 'Jellyfin plugin not enabled' };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          set.status = 404;
          return { error: 'Jellyfin plugin not configured' };
        }

        const candidates =
          query.preferred === 'primary'
            ? ([
                { itemId: query.itemId, imageType: 'Primary', tag: query.primaryTag },
                { itemId: query.itemId, imageType: 'Backdrop', tag: query.backdropTag },
                { itemId: query.parentBackdropItemId, imageType: 'Backdrop', tag: query.parentBackdropTag },
              ] as const)
            : ([
                { itemId: query.itemId, imageType: 'Backdrop', tag: query.backdropTag },
                { itemId: query.parentBackdropItemId, imageType: 'Backdrop', tag: query.parentBackdropTag },
                { itemId: query.itemId, imageType: 'Primary', tag: query.primaryTag },
              ] as const);

        for (const candidate of candidates) {
          if (!candidate.itemId) continue;

          const imageUrl = new URL(
            `/Items/${encodeURIComponent(candidate.itemId)}/Images/${candidate.imageType}`,
            config.website_url
          );
          if (candidate.tag) {
            imageUrl.searchParams.set('tag', candidate.tag);
          }

          const response = await fetch(imageUrl.toString(), {
            headers: {
              'X-Emby-Token': config.api_key,
              Accept: 'image/*',
            },
          });

          const contentType = response.headers.get('content-type');
          if (!response.ok || !contentType || !contentType.startsWith('image/')) {
            continue;
          }

          const imageBuffer = await response.arrayBuffer();
          return new Response(imageBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'private, max-age=21600',
            },
          });
        }

        set.status = 404;
        return { error: 'Image not found' };
      } catch (error) {
        console.error('Error proxying Jellyfin image:', error);
        set.status = 500;
        return { error: 'Failed to proxy Jellyfin image' };
      }
    },
    {
      query: t.Object({
        itemId: t.String(),
        preferred: t.Optional(t.String()),
        parentBackdropItemId: t.Optional(t.String()),
        backdropTag: t.Optional(t.String()),
        parentBackdropTag: t.Optional(t.String()),
        primaryTag: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/jellyfin/latest',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const requestedPage = toPositiveInt(query.page, 1);
        const page = Math.max(1, Math.min(100, requestedPage));
        const requestedLimit = toPositiveInt(query.limit, 12);
        const limit = Math.max(1, Math.min(30, requestedLimit));
        const startIndex = (page - 1) * limit;

        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          return { enabled: false, items: [], page, limit, has_more: false };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          return { enabled: false, items: [], page, limit, has_more: false };
        }

        const jellyfinUrl = new URL('/Items', config.website_url);
        jellyfinUrl.searchParams.set('Recursive', 'true');
        jellyfinUrl.searchParams.set('SortBy', 'DateCreated');
        jellyfinUrl.searchParams.set('SortOrder', 'Descending');
        jellyfinUrl.searchParams.set('IncludeItemTypes', 'Movie,Series,MusicAlbum,Audio,Video');
        jellyfinUrl.searchParams.set(
          'Fields',
          'DateCreated,Overview,ProductionYear,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,ImageTags'
        );
        jellyfinUrl.searchParams.set('Limit', String(limit));
        jellyfinUrl.searchParams.set('StartIndex', String(startIndex));

        const response = await fetch(jellyfinUrl.toString(), {
          headers: {
            'X-Emby-Token': config.api_key,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          set.status = 502;
          return { error: 'Jellyfin request failed' };
        }

        const data = (await response.json()) as Record<string, unknown>;
        const rawItems = Array.isArray(data.Items) ? data.Items : [];
        const totalRecordCountRaw =
          typeof data.TotalRecordCount === 'number' ? Math.trunc(data.TotalRecordCount) : Number.NaN;
        const totalRecordCount = Number.isFinite(totalRecordCountRaw) ? totalRecordCountRaw : null;
        const items = rawItems
          .map(item => mapJellyfinApiItem(item, config.website_url))
          .filter((item): item is JellyfinLatestItem => !!item);
        const hasMore =
          totalRecordCount !== null ? startIndex + rawItems.length < totalRecordCount : rawItems.length === limit;

        return { enabled: true, items, page, limit, has_more: hasMore };
      } catch (error) {
        console.error('Error getting latest Jellyfin items:', error);
        set.status = 500;
        return { error: 'Failed to get latest Jellyfin items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        page: t.Optional(t.String()),
      }),
    }
  );
