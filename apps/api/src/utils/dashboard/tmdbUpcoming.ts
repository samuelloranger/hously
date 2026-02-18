import { prisma } from '../../db';
import { toRecord, toStringOrNull } from '../coerce';
import type { ArrPluginStatus, DashboardUpcomingItem, DashboardUpcomingProvider } from '../../types/dashboardUpcoming';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const TMDB_PROVIDER_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_WEB_BASE_URL = 'https://www.themoviedb.org';

export const TMDB_UPCOMING_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const getArrPluginStatus = async (): Promise<ArrPluginStatus> => {
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

export const toIsoDate = (date: Date): string => {
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

export const parseTmdbNumericId = (itemId: string): number | null => {
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

export const collectTmdbUpcoming = async (
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

export const fetchTmdbProviders = async (
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
