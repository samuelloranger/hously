import { prisma } from '../../db';
import { toRecord, toStringOrNull } from '@hously/shared';
import type { ArrPluginStatus, DashboardUpcomingItem, DashboardUpcomingProvider } from '../../types/dashboardUpcoming';
import { normalizeJellyfinConfig } from '../plugins/normalizers';
import { getJsonCache, setJsonCache } from '../../services/cache';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w780';
const TMDB_PROVIDER_LOGO_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_WEB_BASE_URL = 'https://www.themoviedb.org';

export const TMDB_UPCOMING_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const TMDB_UPCOMING_CACHE_KEY = 'dashboard:tmdb:upcoming:v6';
const JELLYFIN_TMDB_IDS_CACHE_TTL_SECONDS = 60 * 60;
const JELLYFIN_TMDB_IDS_CACHE_KEY = 'dashboard:jellyfin:tmdb-ids:v1';

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
  const backdropPath = toStringOrNull(item.backdrop_path);
  const overview = toStringOrNull(item.overview);
  const popularity = typeof item.popularity === 'number' && Number.isFinite(item.popularity) ? item.popularity : 0;
  const voteAverage =
    typeof item.vote_average === 'number' && Number.isFinite(item.vote_average) && item.vote_average > 0
      ? item.vote_average
      : null;

  return {
    id: `${mediaType}-${numericId}`,
    title,
    media_type: mediaType,
    release_date: releaseDate,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : null,
    backdrop_url: backdropPath ? `${TMDB_BACKDROP_BASE_URL}${backdropPath}` : null,
    overview,
    tmdb_url: `${TMDB_WEB_BASE_URL}/${mediaType}/${numericId}`,
    providers: [],
    vote_average: voteAverage,
    popularity,
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
  fromDateIso: string | null,
  toDateIso: string
): Promise<{ items: DashboardUpcomingItem[]; totalPages: number } | null> => {
  const endpoint = mediaType === 'movie' ? 'discover/movie' : 'discover/tv';
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set('api_key', tmdbApiKey);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', String(page));

  if (mediaType === 'movie') {
    // Prioritize mainstream/popular titles and avoid low-signal niche results.
    url.searchParams.set('sort_by', 'popularity.desc');
    url.searchParams.set('region', 'US');
    if (fromDateIso) url.searchParams.set('release_date.gte', fromDateIso);
    url.searchParams.set('release_date.lte', toDateIso);
    url.searchParams.set('with_release_type', '4|5');
    url.searchParams.set('with_origin_country', 'US|CA');
    url.searchParams.set('with_original_language', 'en|fr');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('include_video', 'false');
  } else {
    url.searchParams.set('sort_by', 'popularity.desc');
    if (fromDateIso) url.searchParams.set('first_air_date.gte', fromDateIso);
    url.searchParams.set('first_air_date.lte', toDateIso);
    url.searchParams.set('include_null_first_air_dates', 'false');
    url.searchParams.set('with_origin_country', 'US|CA');
    url.searchParams.set('with_original_language', 'en|fr');
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
  fromDateIso: string | null,
  toDateIso: string
): Promise<{ items: DashboardUpcomingItem[]; hasMore: boolean } | null> => {
  const items: DashboardUpcomingItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (items.length < requiredCount && page <= totalPages) {
    const response = await fetchTmdbDiscoverPage(mediaType, page, tmdbApiKey, fromDateIso, toDateIso);
    if (!response) return null;
    items.push(...response.items);
    totalPages = response.totalPages;
    page += 1;
  }

  return { items, hasMore: page <= totalPages };
};

export const fetchJellyfinTmdbIds = async (): Promise<Set<number>> => {
  const jellyfinPlugin = await prisma.plugin.findFirst({
    where: { type: 'jellyfin' },
    select: { enabled: true, config: true },
  });

  if (!jellyfinPlugin?.enabled) return new Set<number>();

  const config = normalizeJellyfinConfig(jellyfinPlugin.config);
  if (!config) return new Set<number>();

  const cached = await getJsonCache<{ ids: number[] }>(JELLYFIN_TMDB_IDS_CACHE_KEY);
  if (cached && Array.isArray(cached.ids)) {
    return new Set(cached.ids.filter(id => Number.isFinite(id) && id > 0).map(id => Math.trunc(id)));
  }

  const tmdbIds = new Set<number>();
  const PAGE_SIZE = 300;
  const MAX_PAGES = 20;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const startIndex = page * PAGE_SIZE;
    const jellyfinUrl = new URL('/Items', config.website_url);
    jellyfinUrl.searchParams.set('Recursive', 'true');
    jellyfinUrl.searchParams.set('IncludeItemTypes', 'Movie,Series');
    jellyfinUrl.searchParams.set('Fields', 'ProviderIds');
    jellyfinUrl.searchParams.set('Limit', String(PAGE_SIZE));
    jellyfinUrl.searchParams.set('StartIndex', String(startIndex));

    const response = await fetch(jellyfinUrl.toString(), {
      headers: {
        'X-Emby-Token': config.api_key,
        Accept: 'application/json',
      },
    });

    if (!response.ok) break;

    const data = (await response.json()) as Record<string, unknown>;
    const rawItems = Array.isArray(data.Items) ? data.Items : [];
    if (rawItems.length === 0) break;

    for (const rawItem of rawItems) {
      const item = toRecord(rawItem);
      const providerIds = toRecord(item?.ProviderIds);
      const tmdbRaw = toStringOrNull(providerIds?.Tmdb) || toStringOrNull(providerIds?.tmdb);
      if (!tmdbRaw) continue;

      const tmdbId = parseInt(tmdbRaw, 10);
      if (Number.isFinite(tmdbId) && tmdbId > 0) {
        tmdbIds.add(tmdbId);
      }
    }

    if (rawItems.length < PAGE_SIZE) break;
  }

  await setJsonCache(
    JELLYFIN_TMDB_IDS_CACHE_KEY,
    {
      ids: [...tmdbIds],
    },
    JELLYFIN_TMDB_IDS_CACHE_TTL_SECONDS
  );

  return tmdbIds;
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

/**
 * Fetch the digital (type 4) or physical (type 5) release date for a movie
 * in the US region from TMDB's /movie/{id}/release_dates endpoint.
 * Returns the ISO date string (YYYY-MM-DD) or null if not found.
 */
export const fetchMovieReleaseDates = async (tmdbId: number, tmdbApiKey: string): Promise<string | null> => {
  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}/release_dates`);
    url.searchParams.set('api_key', tmdbApiKey);

    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const results = Array.isArray(data.results) ? data.results : [];

    const usEntry = results.find((entry: unknown) => {
      const e = toRecord(entry);
      return e && toStringOrNull(e.iso_3166_1) === 'US';
    });
    if (!usEntry) return null;

    const usRecord = toRecord(usEntry);
    const releaseDates = Array.isArray(usRecord?.release_dates) ? usRecord.release_dates : [];

    let digitalDate: string | null = null;
    let physicalDate: string | null = null;

    for (const rd of releaseDates) {
      const rdRecord = toRecord(rd);
      if (!rdRecord) continue;
      const type = typeof rdRecord.type === 'number' ? rdRecord.type : null;
      const dateStr = toStringOrNull(rdRecord.release_date);
      if (!dateStr) continue;

      const isoDate = dateStr.substring(0, 10);
      if (type === 4 && !digitalDate) digitalDate = isoDate;
      if (type === 5 && !physicalDate) physicalDate = isoDate;
    }

    return digitalDate || physicalDate || null;
  } catch {
    return null;
  }
};
