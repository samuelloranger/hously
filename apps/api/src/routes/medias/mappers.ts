import { randomUUID } from 'crypto';
import type { MediaItem } from '@hously/shared';
import { getJsonCache, setJsonCache } from '../../services/cache';

export type TmdbProvider = {
  id: number;
  name: string;
  logo_url: string;
};

export type TmdbWatchProvidersResult = {
  region: string;
  streaming: TmdbProvider[];
  free: TmdbProvider[];
  rent: TmdbProvider[];
  buy: TmdbProvider[];
  link: string | null;
};

export type TmdbSearchItem = {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  release_year: number | null;
  poster_url: string | null;
  overview: string | null;
  vote_average: number | null;
  service: 'radarr' | 'sonarr';
  already_exists: boolean;
  can_add: boolean;
  source_id: number | null;
  arr_url: string | null;
};

export type InteractiveReleaseItem = {
  guid: string;
  title: string;
  indexer: string | null;
  indexer_id: number | null;
  languages: string[];
  protocol: string | null;
  size_bytes: number | null;
  age: number | null;
  seeders: number | null;
  leechers: number | null;
  rejected: boolean;
  rejection_reason: string | null;
  info_url: string | null;
  source: 'arr' | 'prowlarr';
  download_token?: string | null;
};

export type ArrEntry = { sourceId: number; titleSlug: string | null };

const PROWLARR_RELEASE_TTL_MS = 15 * 60 * 1000;
const prowlarrReleasePayloads = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();

export const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const toBoolean = (value: unknown): boolean => Boolean(value);

export const toUniqueStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    let candidate: string | null = null;
    if (typeof entry === 'string') candidate = toStringOrNull(entry);
    else {
      const record = toRecord(entry);
      candidate =
        toStringOrNull(record?.name) ||
        toStringOrNull(record?.value) ||
        toStringOrNull(record?.title) ||
        toStringOrNull(record?.label);
    }

    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }

  return out;
};

export const extractInteractiveLanguages = (row: Record<string, unknown>): string[] => {
  const languages = toUniqueStringArray(row.languages);
  if (languages.length > 0) return languages;

  const singleLanguage = row.language;
  if (typeof singleLanguage === 'string') {
    const value = toStringOrNull(singleLanguage);
    return value ? [value] : [];
  }

  const languageRecord = toRecord(singleLanguage);
  if (!languageRecord) return [];
  const value =
    toStringOrNull(languageRecord.name) ||
    toStringOrNull(languageRecord.value) ||
    toStringOrNull(languageRecord.title) ||
    toStringOrNull(languageRecord.label);
  return value ? [value] : [];
};

export const toIsoOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export const resolveImageUrl = (baseUrl: string, value: unknown): string | null => {
  const raw = toStringOrNull(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, baseUrl).toString();
  } catch {
    return null;
  }
};

export const buildArrItemUrl = (baseUrl: string, service: 'radarr' | 'sonarr', slug: string): string | null => {
  try {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, '');
    const itemPath = service === 'radarr' ? 'movie' : 'series';
    url.pathname = `${basePath}/${itemPath}/${slug}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

export const parseReleaseYear = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length < 4) return null;
  const year = parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

export const extractPosterUrl = (baseUrl: string, imagesValue: unknown): string | null => {
  if (!Array.isArray(imagesValue)) return null;

  for (const rawImage of imagesValue) {
    const image = toRecord(rawImage);
    if (!image) continue;
    const coverType = toStringOrNull(image.coverType)?.toLowerCase();
    if (coverType !== 'poster') continue;

    const remoteUrl = resolveImageUrl(baseUrl, image.remoteUrl);
    if (remoteUrl) return remoteUrl;

    const localUrl = resolveImageUrl(baseUrl, image.url);
    if (localUrl) return localUrl;
  }

  return null;
};

const LANG_TAGS = /\b(MULTI[._]VF2|MULTI[._]VFF|MULTI[._]VFQ|VF2|VFF|VFQ|VFI|TRUEFRENCH|FRENCH)\b/i;
const RESOLUTION_TAGS = /\b(2160p|1080p|720p|480p|4K|UHD)\b/i;
const SOURCE_TAGS = /\b(BluRay|BDRip|BRRip|HDLight|WEBRip|WEB-DL|WEB|HDTV|DVDRip|Remux)\b/i;

export function parseReleaseTags(name: string): string[] {
  const tags: string[] = [];
  const parts = name.replace(/\./g, ' ');

  const lang = parts.match(LANG_TAGS);
  if (lang) tags.push(lang[1].replace(/[._]/g, '.'));

  const res = parts.match(RESOLUTION_TAGS);
  if (res) tags.push(res[1]);

  const src = parts.match(SOURCE_TAGS);
  if (src) tags.push(src[1]);

  // Release group: after the last hyphen
  const lastHyphen = name.lastIndexOf('-');
  if (lastHyphen > 0 && lastHyphen < name.length - 1) {
    const group = name.substring(lastHyphen + 1).replace(/\.\w{2,4}$/, ''); // strip file extension
    if (group) tags.push(group);
  }

  return tags;
}

function extractReleaseTags(row: Record<string, unknown>): string[] | null {
  const movieFile = toRecord(row.movieFile);
  if (!movieFile) return null;

  const sceneName = toStringOrNull(movieFile.sceneName);
  if (sceneName) return parseReleaseTags(sceneName);

  const relativePath = toStringOrNull(movieFile.relativePath);
  if (relativePath) return parseReleaseTags(relativePath);

  return null;
}

function extractSeriesReleaseTags(_row: Record<string, unknown>): string[] | null {
  // Sonarr series list response doesn't include episode file data.
  // Tags are populated separately via fetchSonarrSeriesReleaseTags.
  return null;
}

/**
 * Fetch one episode file per series from Sonarr, parse release tags, and cache in Redis.
 * Returns a map of sourceId -> tags.
 */
export async function fetchSonarrSeriesReleaseTags(
  websiteUrl: string,
  apiKey: string,
  seriesIds: number[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (seriesIds.length === 0) return result;

  // Check Redis cache for each series
  const uncachedIds: number[] = [];
  await Promise.all(
    seriesIds.map(async (id) => {
      const cached = await getJsonCache<string[]>(`sonarr:release-tags:${id}`);
      if (cached) {
        result.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    }),
  );

  if (uncachedIds.length === 0) return result;

  // Fetch episode files for uncached series (concurrency limited to 5)
  const CONCURRENCY = 5;
  for (let i = 0; i < uncachedIds.length; i += CONCURRENCY) {
    const batch = uncachedIds.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (seriesId) => {
        const url = new URL('/api/v3/episodefile', websiteUrl);
        url.searchParams.set('seriesId', String(seriesId));
        const res = await fetch(url.toString(), {
          headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        });
        if (!res.ok) return { seriesId, tags: null as string[] | null };

        const files = (await res.json()) as unknown[];
        // Pick the most recent file (last in array)
        for (let j = files.length - 1; j >= 0; j--) {
          const file = toRecord(files[j]);
          if (!file) continue;
          const sceneName = toStringOrNull(file.sceneName);
          if (sceneName) {
            const tags = parseReleaseTags(sceneName);
            if (tags.length > 0) return { seriesId, tags };
          }
          const relativePath = toStringOrNull(file.relativePath);
          if (relativePath) {
            const tags = parseReleaseTags(relativePath);
            if (tags.length > 0) return { seriesId, tags };
          }
        }
        return { seriesId, tags: null as string[] | null };
      }),
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { seriesId, tags } = r.value;
      if (tags && tags.length > 0) {
        result.set(seriesId, tags);
        await setJsonCache(`sonarr:release-tags:${seriesId}`, tags, 86400); // 24h cache
      }
    }
  }

  return result;
}

export const mapRadarrMovie = (raw: unknown, baseUrl: string): MediaItem | null => {
  const row = toRecord(raw);
  if (!row) return null;

  const sourceId = toNumberOrNull(row.id);
  const title = toStringOrNull(row.title);
  if (!sourceId || !title) return null;

  const tmdbId = toNumberOrNull(row.tmdbId);

  return {
    id: `radarr-${sourceId}`,
    media_type: 'movie',
    service: 'radarr',
    source_id: sourceId,
    title,
    sort_title: toStringOrNull(row.sortTitle),
    year: toNumberOrNull(row.year),
    status: toStringOrNull(row.status),
    monitored: toBoolean(row.monitored),
    downloaded: toBoolean(row.hasFile),
    downloading: false,
    added_at: toIsoOrNull(row.added),
    tmdb_id: tmdbId,
    imdb_id: toStringOrNull(row.imdbId),
    tvdb_id: null,
    season_count: null,
    episode_count: null,
    poster_url: extractPosterUrl(baseUrl, row.images),
    arr_url: tmdbId ? buildArrItemUrl(baseUrl, 'radarr', String(tmdbId)) : null,
    release_tags: extractReleaseTags(row),
  };
};

export const mapSonarrSeries = (raw: unknown, baseUrl: string): MediaItem | null => {
  const row = toRecord(raw);
  if (!row) return null;

  const sourceId = toNumberOrNull(row.id);
  const title = toStringOrNull(row.title);
  if (!sourceId || !title) return null;

  const statistics = toRecord(row.statistics);
  const seasons = Array.isArray(row.seasons) ? row.seasons : [];
  const seasonCount = seasons.filter(season => {
    const seasonRow = toRecord(season);
    const seasonNumber = seasonRow ? toNumberOrNull(seasonRow.seasonNumber) : null;
    return seasonNumber !== null && seasonNumber > 0;
  }).length;

  const episodeCount = toNumberOrNull(statistics?.totalEpisodeCount ?? statistics?.episodeCount);
  const episodeFileCount = toNumberOrNull(statistics?.episodeFileCount);
  const sizeOnDisk = toNumberOrNull(statistics?.sizeOnDisk);
  const downloaded = (episodeFileCount !== null && episodeFileCount > 0) || (sizeOnDisk !== null && sizeOnDisk > 0);

  const titleSlug = toStringOrNull(row.titleSlug);

  return {
    id: `sonarr-${sourceId}`,
    media_type: 'series',
    service: 'sonarr',
    source_id: sourceId,
    title,
    sort_title: toStringOrNull(row.sortTitle),
    year: toNumberOrNull(row.year),
    status: toStringOrNull(row.status),
    monitored: toBoolean(row.monitored),
    downloaded,
    downloading: false,
    added_at: toIsoOrNull(row.added),
    tmdb_id: toNumberOrNull(row.tmdbId),
    imdb_id: toStringOrNull(row.imdbId),
    tvdb_id: toNumberOrNull(row.tvdbId),
    season_count: seasonCount,
    episode_count: episodeCount,
    poster_url: extractPosterUrl(baseUrl, row.images),
    arr_url: titleSlug ? buildArrItemUrl(baseUrl, 'sonarr', titleSlug) : null,
    release_tags: extractSeriesReleaseTags(row),
  };
};

export const fetchRadarrDownloadingMovieIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
  const url = new URL('/api/v3/queue', websiteUrl);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '2000');

  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) throw new Error(`Radarr queue request failed with status ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  const records = Array.isArray(data.records) ? data.records : [];
  const ids = new Set<number>();

  for (const raw of records) {
    const row = toRecord(raw);
    if (!row) continue;

    const status = toStringOrNull(row.status)?.toLowerCase();
    const trackedStatuses = new Set(['queued', 'delayed', 'downloading', 'completed', 'warning']);
    if (status && !trackedStatuses.has(status)) continue;

    const movieId = toNumberOrNull(row.movieId) ?? toNumberOrNull(toRecord(row.movie)?.id);
    if (movieId && movieId > 0) ids.add(movieId);
  }

  return ids;
};

export const fetchSonarrDownloadingSeriesIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
  const url = new URL('/api/v3/queue', websiteUrl);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '2000');

  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) throw new Error(`Sonarr queue request failed with status ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  const records = Array.isArray(data.records) ? data.records : [];
  const ids = new Set<number>();

  for (const raw of records) {
    const row = toRecord(raw);
    if (!row) continue;

    const status = toStringOrNull(row.status)?.toLowerCase();
    const trackedStatuses = new Set(['queued', 'delayed', 'downloading', 'completed', 'warning']);
    if (status && !trackedStatuses.has(status)) continue;

    const seriesId = toNumberOrNull(row.seriesId) ?? toNumberOrNull(toRecord(row.series)?.id);
    if (seriesId && seriesId > 0) ids.add(seriesId);
  }

  return ids;
};

export const mapTmdbSearchItem = (raw: unknown): TmdbSearchItem | null => {
  const row = toRecord(raw);
  if (!row) return null;

  const mediaType = toStringOrNull(row.media_type);
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;

  const tmdbId = toNumberOrNull(row.id);
  if (!tmdbId) return null;

  const title = toStringOrNull(row.title) || toStringOrNull(row.name);
  if (!title) return null;

  const posterPath = toStringOrNull(row.poster_path);
  const releaseYear = parseReleaseYear(row.release_date) ?? parseReleaseYear(row.first_air_date);
  const overview = toStringOrNull(row.overview);
  const voteAverage = toNumberOrNull(row.vote_average);

  return {
    id: `${mediaType}-${tmdbId}`,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title,
    release_year: releaseYear,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : null,
    overview: overview || null,
    vote_average: voteAverage && voteAverage > 0 ? voteAverage : null,
    service: mediaType === 'movie' ? 'radarr' : 'sonarr',
    already_exists: false,
    can_add: false,
    source_id: null,
    arr_url: null,
  };
};

export const fetchRadarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Map<number, ArrEntry>> => {
  const cacheKey = 'medias:radarr:ids';
  const cached = await getJsonCache<[number, ArrEntry][]>(cacheKey);
  if (cached) return new Map(cached);

  const url = new URL('/api/v3/movie', websiteUrl);
  const response = await fetch(url.toString(), {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Radarr request failed with status ${response.status}`);

  const data = (await response.json()) as unknown[];
  const ids = new Map<number, ArrEntry>();
  for (const raw of data) {
    const row = toRecord(raw);
    const tmdbId = row ? toNumberOrNull(row.tmdbId) : null;
    const sourceId = row ? toNumberOrNull(row.id) : null;
    if (tmdbId && tmdbId > 0 && sourceId && sourceId > 0) {
      ids.set(tmdbId, { sourceId, titleSlug: row ? toStringOrNull(row.titleSlug) : null });
    }
  }

  await setJsonCache(cacheKey, Array.from(ids.entries()), 6 * 60 * 60); // 6 hours
  return ids;
};

export const fetchSonarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Map<number, ArrEntry>> => {
  const cacheKey = 'medias:sonarr:ids';
  const cached = await getJsonCache<[number, ArrEntry][]>(cacheKey);
  if (cached) return new Map(cached);

  const url = new URL('/api/v3/series', websiteUrl);
  const response = await fetch(url.toString(), {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Sonarr request failed with status ${response.status}`);

  const data = (await response.json()) as unknown[];
  const ids = new Map<number, ArrEntry>();
  for (const raw of data) {
    const row = toRecord(raw);
    const tmdbId = row ? toNumberOrNull(row.tmdbId) : null;
    const sourceId = row ? toNumberOrNull(row.id) : null;
    if (tmdbId && tmdbId > 0 && sourceId && sourceId > 0) {
      ids.set(tmdbId, { sourceId, titleSlug: row ? toStringOrNull(row.titleSlug) : null });
    }
  }

  await setJsonCache(cacheKey, Array.from(ids.entries()), 6 * 60 * 60); // 6 hours
  return ids;
};

export const mapInteractiveRelease = (raw: unknown): InteractiveReleaseItem | null => {
  const row = toRecord(raw);
  if (!row) return null;

  const guid = toStringOrNull(row.guid);
  const title = toStringOrNull(row.title);
  if (!guid || !title) return null;

  const rejections = Array.isArray(row.rejections) ? row.rejections : [];
  const indexerRecord = toRecord(row.indexer);
  const indexerName =
    toStringOrNull(row.indexer) || toStringOrNull(indexerRecord?.name) || toStringOrNull(indexerRecord?.title);
  const indexerId = toNumberOrNull(row.indexerId) || toNumberOrNull(row.indexerID) || toNumberOrNull(indexerRecord?.id);
  const rejectionReason =
    rejections.length > 0
      ? rejections
          .map(r => {
            const record = toRecord(r);
            return toStringOrNull(record?.reason) || toStringOrNull(record?.type) || null;
          })
          .filter((v): v is string => Boolean(v))
          .join(', ')
      : null;

  return {
    guid,
    title,
    indexer: indexerName,
    indexer_id: indexerId,
    languages: extractInteractiveLanguages(row),
    protocol: toStringOrNull(row.protocol),
    size_bytes: toNumberOrNull(row.size),
    age: toNumberOrNull(row.age),
    seeders: toNumberOrNull(row.seeders),
    leechers: toNumberOrNull(row.leechers),
    rejected: toBoolean(row.rejected),
    rejection_reason: rejectionReason,
    info_url: toStringOrNull(row.infoUrl),
    source: 'arr',
    download_token: null,
  };
};

const cleanupExpiredProwlarrPayloads = () => {
  const now = Date.now();
  for (const [token, entry] of prowlarrReleasePayloads.entries()) {
    if (entry.expiresAt <= now) {
      prowlarrReleasePayloads.delete(token);
    }
  }
};

export const storeProwlarrReleasePayload = (payload: Record<string, unknown>): string => {
  cleanupExpiredProwlarrPayloads();
  const token = randomUUID();
  prowlarrReleasePayloads.set(token, {
    payload,
    expiresAt: Date.now() + PROWLARR_RELEASE_TTL_MS,
  });
  return token;
};

export const takeProwlarrReleasePayload = (token: string): Record<string, unknown> | null => {
  cleanupExpiredProwlarrPayloads();
  const entry = prowlarrReleasePayloads.get(token);
  if (!entry) return null;
  prowlarrReleasePayloads.delete(token);
  return entry.payload;
};

export const mapProwlarrInteractiveRelease = (raw: unknown): InteractiveReleaseItem | null => {
  const base = mapInteractiveRelease(raw);
  const row = toRecord(raw);
  if (!base || !row) return null;

  const downloadToken = storeProwlarrReleasePayload(row);
  return {
    ...base,
    source: 'prowlarr',
    download_token: downloadToken,
  };
};

export const isSonarrFullSeasonRelease = (raw: unknown): boolean => {
  const row = toRecord(raw);
  if (!row) return false;
  return toBoolean(row.fullSeason);
};
