import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso } from '../utils';
import { getJsonCache, setJsonCache } from '../services/cache';

export interface JellyfinLatestItem {
  id: string;
  title: string;
  subtitle: string | null;
  item_url: string | null;
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

export interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
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

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const TMDB_PROVIDER_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_WEB_BASE_URL = 'https://www.themoviedb.org';
const TMDB_UPCOMING_CACHE_TTL_SECONDS = 24 * 60 * 60;

const toIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const itemUrl = sourceItemId
    ? `${jellyfinWebsiteUrl}/web/index.html#!/details?id=${encodeURIComponent(sourceItemId)}`
    : null;

  return { id, title, subtitle, item_url: itemUrl, item_type: itemType, year, added_at: addedAt };
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
        const tmdbApiKey = process.env.TMDB_API_KEY?.trim();
        if (!tmdbApiKey) {
          return { enabled: false, items: [] };
        }

        const requestedLimit = query.limit ? parseInt(query.limit, 10) : 8;
        const limit = Math.max(1, Math.min(24, Number.isFinite(requestedLimit) ? requestedLimit : 8));
        const today = new Date();
        const todayIso = toIsoDate(today);
        const oneYearOut = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
        const oneYearOutIso = toIsoDate(oneYearOut);
        const cacheKey = `dashboard:tmdb:upcoming:v2:limit:${limit}:from:${todayIso}`;

        const cached = await getJsonCache<{ enabled: boolean; items: DashboardUpcomingItem[] }>(cacheKey);
        if (cached) {
          return cached;
        }

        // Use discover/movie with explicit date bounds to keep only near-future releases.
        const movieUrl = new URL('https://api.themoviedb.org/3/discover/movie');
        movieUrl.searchParams.set('api_key', tmdbApiKey);
        movieUrl.searchParams.set('language', 'en-US');
        movieUrl.searchParams.set('page', '1');
        movieUrl.searchParams.set('sort_by', 'primary_release_date.asc');
        movieUrl.searchParams.set('region', 'US');
        movieUrl.searchParams.set('release_date.gte', todayIso);
        movieUrl.searchParams.set('release_date.lte', oneYearOutIso);
        movieUrl.searchParams.set('with_release_type', '4');
        movieUrl.searchParams.set('with_original_language', 'en');
        movieUrl.searchParams.set('include_adult', 'false');
        movieUrl.searchParams.set('include_video', 'false');

        // Use discover for TV so we can constrain to upcoming/near-future first air dates.
        const tvUrl = new URL('https://api.themoviedb.org/3/discover/tv');
        tvUrl.searchParams.set('api_key', tmdbApiKey);
        tvUrl.searchParams.set('language', 'en-US');
        tvUrl.searchParams.set('page', '1');
        tvUrl.searchParams.set('sort_by', 'first_air_date.asc');
        tvUrl.searchParams.set('first_air_date.gte', todayIso);
        tvUrl.searchParams.set('first_air_date.lte', oneYearOutIso);
        tvUrl.searchParams.set('include_null_first_air_dates', 'false');
        tvUrl.searchParams.set('with_origin_country', 'US');
        tvUrl.searchParams.set('with_original_language', 'en');

        const [moviesResponse, tvResponse] = await Promise.all([
          fetch(movieUrl.toString(), { headers: { Accept: 'application/json' } }),
          fetch(tvUrl.toString(), { headers: { Accept: 'application/json' } }),
        ]);

        if (!moviesResponse.ok || !tvResponse.ok) {
          set.status = 502;
          return { error: 'TMDB request failed' };
        }

        const [moviesData, tvData] = (await Promise.all([
          moviesResponse.json(),
          tvResponse.json(),
        ])) as [Record<string, unknown>, Record<string, unknown>];

        const movieItems = (Array.isArray(moviesData.results) ? moviesData.results : [])
          .map(item => mapTmdbItem(item, 'movie'))
          .filter((item): item is DashboardUpcomingItem => !!item);

        const tvItems = (Array.isArray(tvData.results) ? tvData.results : [])
          .map(item => mapTmdbItem(item, 'tv'))
          .filter((item): item is DashboardUpcomingItem => !!item);

        const merged = [...movieItems, ...tvItems]
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
          })
          .slice(0, limit);

        const itemsWithProviders = await Promise.all(
          merged.map(async item => {
            const tmdbId = parseTmdbNumericId(item.id);
            if (!tmdbId) return item;

            const providers = await fetchTmdbProviders(item.media_type, tmdbId, tmdbApiKey);
            return {
              ...item,
              providers,
            };
          })
        );

        const responsePayload = { enabled: true, items: itemsWithProviders };
        await setJsonCache(cacheKey, responsePayload, TMDB_UPCOMING_CACHE_TTL_SECONDS);
        return responsePayload;
      } catch (error) {
        console.error('Error getting TMDB upcoming items:', error);
        set.status = 500;
        return { error: 'Failed to get TMDB upcoming items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
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
        const requestedLimit = query.limit ? parseInt(query.limit, 10) : 12;
        const limit = Math.max(1, Math.min(30, Number.isFinite(requestedLimit) ? requestedLimit : 12));

        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          return { enabled: false, items: [] };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          return { enabled: false, items: [] };
        }

        const jellyfinUrl = new URL('/Items', config.website_url);
        jellyfinUrl.searchParams.set('Recursive', 'true');
        jellyfinUrl.searchParams.set('SortBy', 'DateCreated');
        jellyfinUrl.searchParams.set('SortOrder', 'Descending');
        jellyfinUrl.searchParams.set('IncludeItemTypes', 'Movie,Series,Episode,MusicAlbum,Audio,Video');
        jellyfinUrl.searchParams.set('Fields', 'DateCreated,Overview,ProductionYear');
        jellyfinUrl.searchParams.set('Limit', String(limit));

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
        const items = rawItems
          .map(item => mapJellyfinApiItem(item, config.website_url))
          .filter((item): item is JellyfinLatestItem => !!item);

        return { enabled: true, items };
      } catch (error) {
        console.error('Error getting latest Jellyfin items:', error);
        set.status = 500;
        return { error: 'Failed to get latest Jellyfin items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  );
