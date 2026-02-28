import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { normalizeRadarrConfig, normalizeSonarrConfig, normalizeTmdbConfig } from '../utils/plugins/normalizers';
import { getJsonCache, setJsonCache, deleteCache } from '../services/cache';
import type { MediaItem } from '@hously/shared';

type TmdbProvider = {
  id: number;
  name: string;
  logo_url: string;
};

type TmdbWatchProvidersResult = {
  region: string;
  streaming: TmdbProvider[];
  free: TmdbProvider[];
  rent: TmdbProvider[];
  buy: TmdbProvider[];
  link: string | null;
};

type TmdbSearchItem = {
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

type InteractiveReleaseItem = {
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
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toBoolean = (value: unknown): boolean => Boolean(value);

const toUniqueStringArray = (value: unknown): string[] => {
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

const extractInteractiveLanguages = (row: Record<string, unknown>): string[] => {
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

const toIsoOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const resolveImageUrl = (baseUrl: string, value: unknown): string | null => {
  const raw = toStringOrNull(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, baseUrl).toString();
  } catch {
    return null;
  }
};

const buildArrItemUrl = (baseUrl: string, service: 'radarr' | 'sonarr', slug: string): string | null => {
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

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

const parseReleaseYear = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length < 4) return null;
  const year = parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

const extractPosterUrl = (baseUrl: string, imagesValue: unknown): string | null => {
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

const mapRadarrMovie = (raw: unknown, baseUrl: string): MediaItem | null => {
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
  };
};

const mapSonarrSeries = (raw: unknown, baseUrl: string): MediaItem | null => {
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
  };
};

const fetchRadarrDownloadingMovieIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
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

const fetchSonarrDownloadingSeriesIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
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

const mapTmdbSearchItem = (raw: unknown): TmdbSearchItem | null => {
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

type ArrEntry = { sourceId: number; titleSlug: string | null };

const fetchRadarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Map<number, ArrEntry>> => {
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

const fetchSonarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Map<number, ArrEntry>> => {
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

const mapInteractiveRelease = (raw: unknown): InteractiveReleaseItem | null => {
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
  };
};

const isSonarrFullSeasonRelease = (raw: unknown): boolean => {
  const row = toRecord(raw);
  if (!row) return false;
  return toBoolean(row.fullSeason);
};

export const mediasRoutes = new Elysia({ prefix: '/api/medias' })
  .use(auth)
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const response: {
      radarr_enabled: boolean;
      sonarr_enabled: boolean;
      radarr_connected: boolean;
      sonarr_connected: boolean;
      items: MediaItem[];
      errors?: { radarr?: string; sonarr?: string };
    } = {
      radarr_enabled: false,
      sonarr_enabled: false,
      radarr_connected: false,
      sonarr_connected: false,
      items: [],
    };

    const errors: { radarr?: string; sonarr?: string } = {};

    try {
      const [radarrPlugin, sonarrPlugin] = await Promise.all([
        prisma.plugin.findFirst({
          where: { type: 'radarr' },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        }),
      ]);

      response.radarr_enabled = Boolean(radarrPlugin?.enabled);
      response.sonarr_enabled = Boolean(sonarrPlugin?.enabled);

      if (radarrPlugin?.enabled) {
        const radarrConfig = normalizeRadarrConfig(radarrPlugin.config);
        if (!radarrConfig) {
          errors.radarr = 'Radarr plugin is not configured';
        } else {
          try {
            const radarrUrl = new URL('/api/v3/movie', radarrConfig.website_url);
            const [radarrRes, queueIds] = await Promise.all([
              fetch(radarrUrl.toString(), {
                headers: {
                  'X-Api-Key': radarrConfig.api_key,
                  Accept: 'application/json',
                },
              }),
              fetchRadarrDownloadingMovieIds(radarrConfig.website_url, radarrConfig.api_key).catch(
                () => new Set<number>()
              ),
            ]);

            if (!radarrRes.ok) {
              errors.radarr = `Radarr request failed with status ${radarrRes.status}`;
            } else {
              const movies = (await radarrRes.json()) as unknown[];
              response.radarr_connected = true;
              response.items.push(
                ...movies
                  .map(movie => {
                    const item = mapRadarrMovie(movie, radarrConfig.website_url);
                    if (!item) return null;
                    return {
                      ...item,
                      downloading: !item.downloaded && queueIds.has(item.source_id),
                    };
                  })
                  .filter((item): item is MediaItem => Boolean(item))
              );
            }
          } catch (error) {
            errors.radarr = error instanceof Error ? error.message : 'Failed to fetch Radarr media';
          }
        }
      }

      if (sonarrPlugin?.enabled) {
        const sonarrConfig = normalizeSonarrConfig(sonarrPlugin.config);
        if (!sonarrConfig) {
          errors.sonarr = 'Sonarr plugin is not configured';
        } else {
          try {
            const sonarrUrl = new URL('/api/v3/series', sonarrConfig.website_url);
            const [sonarrRes, queueIds] = await Promise.all([
              fetch(sonarrUrl.toString(), {
                headers: {
                  'X-Api-Key': sonarrConfig.api_key,
                  Accept: 'application/json',
                },
              }),
              fetchSonarrDownloadingSeriesIds(sonarrConfig.website_url, sonarrConfig.api_key).catch(
                () => new Set<number>()
              ),
            ]);

            if (!sonarrRes.ok) {
              errors.sonarr = `Sonarr request failed with status ${sonarrRes.status}`;
            } else {
              const series = (await sonarrRes.json()) as unknown[];
              response.sonarr_connected = true;
              response.items.push(
                ...series
                  .map(show => {
                    const item = mapSonarrSeries(show, sonarrConfig.website_url);
                    if (!item) return null;
                    return {
                      ...item,
                      downloading: !item.downloaded && queueIds.has(item.source_id),
                    };
                  })
                  .filter((item): item is MediaItem => Boolean(item))
              );
            }
          } catch (error) {
            errors.sonarr = error instanceof Error ? error.message : 'Failed to fetch Sonarr media';
          }
        }
      }

      response.items.sort((a, b) => {
        const aTitle = (a.sort_title || a.title).toLowerCase();
        const bTitle = (b.sort_title || b.title).toLowerCase();
        return aTitle.localeCompare(bTitle);
      });

      if (errors.radarr || errors.sonarr) {
        response.errors = errors;
      }

      return response;
    } catch (error) {
      console.error('Error fetching medias:', error);
      set.status = 500;
      return { error: 'Failed to fetch medias' };
    }
  })
  .get(
    '/tmdb-search',
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const q = query.q.trim();
      if (q.length < 2) {
        return {
          enabled: true,
          radarr_enabled: false,
          sonarr_enabled: false,
          items: [],
        };
      }

      const response: {
        enabled: boolean;
        radarr_enabled: boolean;
        sonarr_enabled: boolean;
        items: TmdbSearchItem[];
        errors?: { radarr?: string; sonarr?: string };
      } = {
        enabled: true,
        radarr_enabled: false,
        sonarr_enabled: false,
        items: [],
      };
      const errors: { radarr?: string; sonarr?: string } = {};

      try {
        const [tmdbPlugin, radarrPlugin, sonarrPlugin] = await Promise.all([
          prisma.plugin.findFirst({
            where: { type: 'tmdb' },
            select: { enabled: true, config: true },
          }),
          prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          }),
          prisma.plugin.findFirst({
            where: { type: 'sonarr' },
            select: { enabled: true, config: true },
          }),
        ]);

        const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
        if (!tmdbConfig) {
          set.status = 400;
          return { error: 'TMDB is not configured' };
        }

        const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
        const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;
        response.radarr_enabled = Boolean(radarrConfig);
        response.sonarr_enabled = Boolean(sonarrConfig);

        const searchUrl = new URL('https://api.themoviedb.org/3/search/multi');
        searchUrl.searchParams.set('api_key', tmdbConfig.api_key);
        searchUrl.searchParams.set('query', q);
        searchUrl.searchParams.set('include_adult', 'false');
        searchUrl.searchParams.set('language', 'en-US');
        searchUrl.searchParams.set('page', '1');

        const searchRes = await fetch(searchUrl.toString(), { headers: { Accept: 'application/json' } });
        if (!searchRes.ok) {
          set.status = 502;
          return { error: `TMDB search failed with status ${searchRes.status}` };
        }

        const searchData = (await searchRes.json()) as Record<string, unknown>;
        let items = (Array.isArray(searchData.results) ? searchData.results : [])
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .slice(0, 20);

        let radarrIds = new Map<number, ArrEntry>();
        let sonarrIds = new Map<number, ArrEntry>();

        await Promise.all([
          (async () => {
            if (!radarrConfig) return;
            try {
              radarrIds = await fetchRadarrTmdbIds(radarrConfig.website_url, radarrConfig.api_key);
            } catch (error) {
              errors.radarr = error instanceof Error ? error.message : 'Failed to fetch Radarr IDs';
            }
          })(),
          (async () => {
            if (!sonarrConfig) return;
            try {
              sonarrIds = await fetchSonarrTmdbIds(sonarrConfig.website_url, sonarrConfig.api_key);
            } catch (error) {
              errors.sonarr = error instanceof Error ? error.message : 'Failed to fetch Sonarr IDs';
            }
          })(),
        ]);

        items = items.map(item => {
          const isMovie = item.media_type === 'movie';
          const entry = isMovie ? radarrIds.get(item.tmdb_id) : sonarrIds.get(item.tmdb_id);
          const sourceId = entry?.sourceId ?? null;
          const sourceBaseUrl = isMovie ? radarrConfig?.website_url : sonarrConfig?.website_url;

          let arr_url: string | null = null;
          if (sourceBaseUrl && entry) {
            if (isMovie) {
              // Radarr uses the TMDB ID in its web UI URL
              arr_url = buildArrItemUrl(sourceBaseUrl, 'radarr', String(item.tmdb_id));
            } else if (entry.titleSlug) {
              // Sonarr uses the title slug in its web UI URL
              arr_url = buildArrItemUrl(sourceBaseUrl, 'sonarr', entry.titleSlug);
            }
          }

          return {
            ...item,
            already_exists: isMovie ? radarrIds.has(item.tmdb_id) : sonarrIds.has(item.tmdb_id),
            can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
            source_id: sourceId,
            arr_url,
          };
        });

        response.items = items;
        if (errors.radarr || errors.sonarr) response.errors = errors;
        return response;
      } catch (error) {
        console.error('Error searching TMDB medias:', error);
        set.status = 500;
        return { error: 'Failed to search TMDB medias' };
      }
    },
    {
      query: t.Object({
        q: t.String(),
      }),
    }
  )
  .get('/explore', async ({ user, set, query }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const [tmdbPlugin, radarrPlugin, sonarrPlugin] = await Promise.all([
        prisma.plugin.findFirst({
          where: { type: 'tmdb' },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: 'radarr' },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        }),
      ]);

      const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
      if (!tmdbConfig) {
        set.status = 400;
        return { error: 'TMDB is not configured' };
      }

      const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
      const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;

      const language = (query as Record<string, string | undefined>).language || 'en-US';
      const skipCache = (query as Record<string, string | undefined>).skipCache === 'true';

      const fetchTmdb = async (path: string) => {
        const url = new URL(`https://api.themoviedb.org/3/${path}`);
        url.searchParams.set('api_key', tmdbConfig.api_key);
        url.searchParams.set('language', language);
        const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        if (!res.ok) return [];
        const data = (await res.json()) as Record<string, unknown>;
        return Array.isArray(data.results) ? data.results : [];
      };

      const injectMediaType = (type: 'movie' | 'tv') => (items: unknown[]) =>
        items.map(item => (typeof item === 'object' && item !== null ? { ...item, media_type: type } : item));

      const [
        trending,
        popularMovies,
        popularShows,
        upcomingMovies,
        nowPlaying,
        airingToday,
        onTheAir,
        topRatedMovies,
        topRatedShows,
        radarrIds,
        sonarrIds,
      ] = await Promise.all([
        fetchTmdb('trending/all/day'),
        fetchTmdb('movie/popular').then(injectMediaType('movie')),
        fetchTmdb('tv/popular').then(injectMediaType('tv')),
        fetchTmdb('movie/upcoming').then(injectMediaType('movie')),
        fetchTmdb('movie/now_playing').then(injectMediaType('movie')),
        fetchTmdb('tv/airing_today').then(injectMediaType('tv')),
        fetchTmdb('tv/on_the_air').then(injectMediaType('tv')),
        fetchTmdb('movie/top_rated').then(injectMediaType('movie')),
        fetchTmdb('tv/top_rated').then(injectMediaType('tv')),
        radarrConfig
          ? fetchRadarrTmdbIds(radarrConfig.website_url, radarrConfig.api_key).catch(() => new Map())
          : Promise.resolve(new Map()),
        sonarrConfig
          ? fetchSonarrTmdbIds(sonarrConfig.website_url, sonarrConfig.api_key).catch(() => new Map())
          : Promise.resolve(new Map()),
      ]);

      const normalize = (items: unknown[]) =>
        items
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .map(item => {
            const isMovie = item.media_type === 'movie';
            const entry = isMovie ? radarrIds.get(item.tmdb_id) : sonarrIds.get(item.tmdb_id);
            const sourceId = entry?.sourceId ?? null;
            const sourceBaseUrl = isMovie ? radarrConfig?.website_url : sonarrConfig?.website_url;

            let arr_url: string | null = null;
            if (sourceBaseUrl && entry) {
              if (isMovie) {
                arr_url = buildArrItemUrl(sourceBaseUrl, 'radarr', String(item.tmdb_id));
              } else if (entry.titleSlug) {
                arr_url = buildArrItemUrl(sourceBaseUrl, 'sonarr', entry.titleSlug);
              }
            }

            return {
              ...item,
              already_exists: isMovie ? radarrIds.has(item.tmdb_id) : sonarrIds.has(item.tmdb_id),
              can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
              source_id: sourceId,
              arr_url,
            };
          });

      // Recommendations based on library items
      const recommendationsCacheKey = `medias:explore:recommendations:${language}`;

      let recommended: TmdbSearchItem[] = [];
      if (!skipCache) {
        const cachedRecommendations = await getJsonCache<TmdbSearchItem[]>(recommendationsCacheKey);
        if (cachedRecommendations) {
          recommended = cachedRecommendations;
        }
      }

      if (!recommended.length) {
        const movieTmdbIds = Array.from(radarrIds.keys());
        const showTmdbIds = Array.from(sonarrIds.keys());

        // Shuffle and pick a sample
        const shuffle = <T>(arr: T[]): T[] => {
          const copy = [...arr];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };
        const sampleMovieIds = shuffle(movieTmdbIds).slice(0, 5);
        const sampleShowIds = shuffle(showTmdbIds).slice(0, 4);

        const recResults = await Promise.all([
          ...sampleMovieIds.map(id =>
            fetchTmdb(`movie/${id}/recommendations`)
              .then(injectMediaType('movie'))
              .catch(() => [] as unknown[])
          ),
          ...sampleShowIds.map(id =>
            fetchTmdb(`tv/${id}/recommendations`)
              .then(injectMediaType('tv'))
              .catch(() => [] as unknown[])
          ),
        ]);

        const allExisting = new Set([...radarrIds.keys(), ...sonarrIds.keys()]);
        const seen = new Set<number>();

        recommended = normalize(recResults.flat())
          .filter(item => {
            if (seen.has(item.tmdb_id) || allExisting.has(item.tmdb_id)) return false;
            seen.add(item.tmdb_id);
            return true;
          })
          .slice(0, 20);

        if (recommended.length > 0) {
          await setJsonCache(recommendationsCacheKey, recommended, 60 * 60); // 1 hour
        }
      }

      return {
        trending: normalize(trending),
        popular_movies: normalize(popularMovies),
        popular_shows: normalize(popularShows),
        upcoming_movies: normalize(upcomingMovies),
        now_playing: normalize(nowPlaying),
        airing_today: normalize(airingToday),
        on_the_air: normalize(onTheAir),
        top_rated_movies: normalize(topRatedMovies),
        top_rated_shows: normalize(topRatedShows),
        recommended,
      };
    } catch (error) {
      console.error('Error fetching TMDB explore:', error);
      set.status = 500;
      return { error: 'Failed to fetch TMDB explore' };
    }
  })
  .get('/explore/:category', async ({ user, set, params, query }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const categoryPaths: Record<string, { path: string; type?: 'movie' | 'tv' }> = {
      trending: { path: 'trending/all/day' },
      popular_movies: { path: 'movie/popular', type: 'movie' },
      popular_shows: { path: 'tv/popular', type: 'tv' },
      upcoming_movies: { path: 'movie/upcoming', type: 'movie' },
      now_playing: { path: 'movie/now_playing', type: 'movie' },
      airing_today: { path: 'tv/airing_today', type: 'tv' },
      on_the_air: { path: 'tv/on_the_air', type: 'tv' },
      top_rated_movies: { path: 'movie/top_rated', type: 'movie' },
      top_rated_shows: { path: 'tv/top_rated', type: 'tv' },
    };

    const category = (params as Record<string, string>).category;
    const config = categoryPaths[category];
    if (!config) {
      set.status = 400;
      return { error: `Unknown category: ${category}` };
    }

    try {
      const [tmdbPlugin, radarrPlugin, sonarrPlugin] = await Promise.all([
        prisma.plugin.findFirst({ where: { type: 'tmdb' }, select: { enabled: true, config: true } }),
        prisma.plugin.findFirst({ where: { type: 'radarr' }, select: { enabled: true, config: true } }),
        prisma.plugin.findFirst({ where: { type: 'sonarr' }, select: { enabled: true, config: true } }),
      ]);

      const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
      if (!tmdbConfig) {
        set.status = 400;
        return { error: 'TMDB is not configured' };
      }

      const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
      const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;

      const q = query as Record<string, string | undefined>;
      const language = q.language || 'en-US';
      const page = parseInt(q.page || '1', 10);

      const url = new URL(`https://api.themoviedb.org/3/${config.path}`);
      url.searchParams.set('api_key', tmdbConfig.api_key);
      url.searchParams.set('language', language);
      url.searchParams.set('page', String(page));

      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        set.status = 502;
        return { error: 'TMDB request failed' };
      }

      const data = (await res.json()) as Record<string, unknown>;
      let items = Array.isArray(data.results) ? data.results : [];

      if (config.type) {
        items = items.map(item =>
          typeof item === 'object' && item !== null ? { ...item, media_type: config.type } : item
        );
      }

      const [radarrIds, sonarrIds] = await Promise.all([
        radarrConfig
          ? fetchRadarrTmdbIds(radarrConfig.website_url, radarrConfig.api_key).catch(() => new Map())
          : Promise.resolve(new Map()),
        sonarrConfig
          ? fetchSonarrTmdbIds(sonarrConfig.website_url, sonarrConfig.api_key).catch(() => new Map())
          : Promise.resolve(new Map()),
      ]);

      const normalized = items
        .map(mapTmdbSearchItem)
        .filter((item): item is TmdbSearchItem => Boolean(item))
        .map(item => {
          const isMovie = item.media_type === 'movie';
          const entry = isMovie ? radarrIds.get(item.tmdb_id) : sonarrIds.get(item.tmdb_id);
          const sourceId = entry?.sourceId ?? null;
          const sourceBaseUrl = isMovie ? radarrConfig?.website_url : sonarrConfig?.website_url;

          let arr_url: string | null = null;
          if (sourceBaseUrl && entry) {
            if (isMovie) {
              arr_url = buildArrItemUrl(sourceBaseUrl, 'radarr', String(item.tmdb_id));
            } else if (entry.titleSlug) {
              arr_url = buildArrItemUrl(sourceBaseUrl, 'sonarr', entry.titleSlug);
            }
          }

          return {
            ...item,
            already_exists: isMovie ? radarrIds.has(item.tmdb_id) : sonarrIds.has(item.tmdb_id),
            can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
            source_id: sourceId,
            arr_url,
          };
        });

      return {
        items: normalized,
        page,
        total_pages: typeof data.total_pages === 'number' ? data.total_pages : 1,
      };
    } catch (error) {
      console.error('Error fetching explore category:', error);
      set.status = 500;
      return { error: 'Failed to fetch category' };
    }
  })
  .get(
    '/similar/:tmdbId',
    async ({ user, set, params, query: queryParams }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const tmdbId = parseInt(params.tmdbId, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
        set.status = 400;
        return { error: 'Invalid TMDB ID' };
      }

      const typedQuery = queryParams as Record<string, string | undefined>;
      const mediaType = typedQuery.type;
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        set.status = 400;
        return { error: 'Invalid type, must be movie or tv' };
      }

      const language = typedQuery.language || 'en-US';

      try {
        const cacheKey = `medias:similar:${mediaType}:${tmdbId}:${language}`;
        const cached = await getJsonCache<TmdbSearchItem[]>(cacheKey);
        if (cached) {
          return { items: cached };
        }

        const [tmdbPlugin, radarrPlugin, sonarrPlugin] = await Promise.all([
          prisma.plugin.findFirst({ where: { type: 'tmdb' }, select: { enabled: true, config: true } }),
          prisma.plugin.findFirst({ where: { type: 'radarr' }, select: { enabled: true, config: true } }),
          prisma.plugin.findFirst({ where: { type: 'sonarr' }, select: { enabled: true, config: true } }),
        ]);

        const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
        if (!tmdbConfig) {
          set.status = 400;
          return { error: 'TMDB is not configured' };
        }

        const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
        const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;

        const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/similar`);
        url.searchParams.set('api_key', tmdbConfig.api_key);
        url.searchParams.set('language', language);
        const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        const rawResults: unknown[] = [];
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          if (Array.isArray(data.results)) rawResults.push(...data.results);
        }

        // Inject media_type since /similar doesn't include it
        const withType = rawResults.map(item =>
          typeof item === 'object' && item !== null ? { ...item, media_type: mediaType } : item
        );

        const [radarrIds, sonarrIds] = await Promise.all([
          radarrConfig
            ? fetchRadarrTmdbIds(radarrConfig.website_url, radarrConfig.api_key).catch(
                () => new Map<number, ArrEntry>()
              )
            : Promise.resolve(new Map<number, ArrEntry>()),
          sonarrConfig
            ? fetchSonarrTmdbIds(sonarrConfig.website_url, sonarrConfig.api_key).catch(
                () => new Map<number, ArrEntry>()
              )
            : Promise.resolve(new Map<number, ArrEntry>()),
        ]);

        const items = withType
          .map(mapTmdbSearchItem)
          .filter((item): item is TmdbSearchItem => Boolean(item))
          .map(item => {
            const isMovie = item.media_type === 'movie';
            const entry = isMovie ? radarrIds.get(item.tmdb_id) : sonarrIds.get(item.tmdb_id);
            const sourceId = entry?.sourceId ?? null;
            const sourceBaseUrl = isMovie ? radarrConfig?.website_url : sonarrConfig?.website_url;

            let arr_url: string | null = null;
            if (sourceBaseUrl && entry) {
              if (isMovie) {
                arr_url = buildArrItemUrl(sourceBaseUrl, 'radarr', String(item.tmdb_id));
              } else if (entry.titleSlug) {
                arr_url = buildArrItemUrl(sourceBaseUrl, 'sonarr', entry.titleSlug);
              }
            }

            return {
              ...item,
              already_exists: isMovie ? radarrIds.has(item.tmdb_id) : sonarrIds.has(item.tmdb_id),
              can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
              source_id: sourceId,
              arr_url,
            };
          })
          .slice(0, 20);

        await setJsonCache(cacheKey, items, 60 * 60); // 1 hour
        return { items };
      } catch (error) {
        console.error('Error fetching similar medias:', error);
        set.status = 500;
        return { error: 'Failed to fetch similar medias' };
      }
    },
    {
      params: t.Object({ tmdbId: t.String() }),
    }
  )
  .get(
    '/providers/:mediaType/:tmdbId',
    async ({ user, set, params, query: queryParams }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        set.status = 400;
        return { error: 'Invalid media type' };
      }

      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
        set.status = 400;
        return { error: 'Invalid TMDB ID' };
      }

      const typedQuery = queryParams as Record<string, string | undefined>;
      const region = typedQuery.region?.toUpperCase() || 'CA';
      const cacheKey = `medias:providers:${mediaType}:${tmdbId}:${region}`;

      const cached = await getJsonCache<TmdbWatchProvidersResult>(cacheKey);
      if (cached) return cached;

      const tmdbPlugin = await prisma.plugin.findFirst({
        where: { type: 'tmdb' },
        select: { enabled: true, config: true },
      });

      const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
      if (!tmdbConfig) {
        return { region, streaming: [], free: [], rent: [], buy: [], link: null };
      }

      try {
        const LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

        const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`);
        url.searchParams.set('api_key', tmdbConfig.api_key);
        const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          return { region, streaming: [], free: [], rent: [], buy: [], link: null };
        }

        const data = (await response.json()) as Record<string, unknown>;
        const results = toRecord(data.results);
        const regionData = toRecord(results?.[region]);

        const mapProviders = (raw: unknown[]): TmdbProvider[] => {
          const seen = new Set<number>();
          return raw
            .map(item => {
              const p = toRecord(item);
              if (!p) return null;
              const id = typeof p.provider_id === 'number' ? Math.trunc(p.provider_id) : null;
              const name = toStringOrNull(p.provider_name);
              const logoPath = toStringOrNull(p.logo_path);
              if (!id || !name || !logoPath || seen.has(id)) return null;
              seen.add(id);
              return { id, name, logo_url: `${LOGO_BASE}${logoPath}` };
            })
            .filter((p): p is TmdbProvider => p !== null);
        };

        const result: TmdbWatchProvidersResult = {
          region,
          streaming: regionData
            ? mapProviders(Array.isArray(regionData.flatrate) ? (regionData.flatrate as unknown[]) : [])
            : [],
          free: regionData ? mapProviders(Array.isArray(regionData.free) ? (regionData.free as unknown[]) : []) : [],
          rent: regionData ? mapProviders(Array.isArray(regionData.rent) ? (regionData.rent as unknown[]) : []) : [],
          buy: regionData ? mapProviders(Array.isArray(regionData.buy) ? (regionData.buy as unknown[]) : []) : [],
          link: regionData ? toStringOrNull(regionData.link) : null,
        };

        await setJsonCache(cacheKey, result, 6 * 60 * 60);
        return result;
      } catch {
        return { region, streaming: [], free: [], rent: [], buy: [], link: null };
      }
    },
    {
      params: t.Object({ mediaType: t.String(), tmdbId: t.String() }),
    }
  )
  .post(
    '/:service/:sourceId/auto-search',
    async ({ user, set, params }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const service = params.service === 'radarr' || params.service === 'sonarr' ? params.service : null;
      const sourceId = parseInt(params.sourceId, 10);

      if (!service) {
        set.status = 400;
        return { error: 'Invalid service' };
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        set.status = 400;
        return { error: 'Invalid source ID' };
      }

      try {
        if (service === 'radarr') {
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

          const commandUrl = new URL('/api/v3/command', config.website_url);
          const commandRes = await fetch(commandUrl.toString(), {
            method: 'POST',
            headers: {
              'X-Api-Key': config.api_key,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              name: 'MoviesSearch',
              movieIds: [sourceId],
            }),
          });

          if (!commandRes.ok) {
            set.status = 502;
            return { error: `Radarr auto-search failed with status ${commandRes.status}` };
          }

          return { success: true, service: 'radarr' as const };
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

        const commandUrl = new URL('/api/v3/command', config.website_url);
        const commandRes = await fetch(commandUrl.toString(), {
          method: 'POST',
          headers: {
            'X-Api-Key': config.api_key,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name: 'SeriesSearch',
            seriesId: sourceId,
          }),
        });

        if (!commandRes.ok) {
          set.status = 502;
          return { error: `Sonarr auto-search failed with status ${commandRes.status}` };
        }

        return { success: true, service: 'sonarr' as const };
      } catch (error) {
        console.error('Error running auto-search:', error);
        set.status = 500;
        return { error: 'Failed to run auto-search' };
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    }
  )
  .get(
    '/:service/:sourceId/interactive-search',
    async ({ user, set, params, query }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const service = params.service === 'radarr' || params.service === 'sonarr' ? params.service : null;
      const sourceId = parseInt(params.sourceId, 10);
      const seasonNumber = query.season ? parseInt(query.season, 10) : null;

      if (!service) {
        set.status = 400;
        return { error: 'Invalid service' };
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        set.status = 400;
        return { error: 'Invalid source ID' };
      }

      try {
        if (service === 'radarr') {
          const plugin = await prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            set.status = 400;
            return { error: 'Radarr plugin is not enabled' };
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            set.status = 400;
            return { error: 'Radarr plugin is not configured' };
          }

          const url = new URL('/api/v3/release', config.website_url);
          url.searchParams.set('movieId', String(sourceId));
          const releaseRes = await fetch(url.toString(), {
            headers: {
              'X-Api-Key': config.api_key,
              Accept: 'application/json',
            },
          });

          if (!releaseRes.ok) {
            set.status = 502;
            return { error: `Radarr interactive search failed with status ${releaseRes.status}` };
          }

          const releases = (await releaseRes.json()) as unknown[];
          return {
            success: true,
            service: 'radarr' as const,
            releases: releases.map(mapInteractiveRelease).filter((r): r is InteractiveReleaseItem => Boolean(r)),
          };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          set.status = 400;
          return { error: 'Sonarr plugin is not enabled' };
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          set.status = 400;
          return { error: 'Sonarr plugin is not configured' };
        }

        const url = new URL('/api/v3/release', config.website_url);
        url.searchParams.set('seriesId', String(sourceId));
        if (seasonNumber !== null && Number.isFinite(seasonNumber) && seasonNumber >= 0) {
          url.searchParams.set('seasonNumber', String(seasonNumber));
        }
        const releaseRes = await fetch(url.toString(), {
          headers: {
            'X-Api-Key': config.api_key,
            Accept: 'application/json',
          },
        });

        if (!releaseRes.ok) {
          set.status = 502;
          return { error: `Sonarr interactive search failed with status ${releaseRes.status}` };
        }

        const releases = (await releaseRes.json()) as unknown[];
        // When searching by season, return all releases; otherwise only full season packs
        const filtered = seasonNumber !== null ? releases : releases.filter(isSonarrFullSeasonRelease);
        return {
          success: true,
          service: 'sonarr' as const,
          releases: filtered
            .map(mapInteractiveRelease)
            .filter((r): r is InteractiveReleaseItem => Boolean(r)),
        };
      } catch (error) {
        console.error('Error loading interactive search releases:', error);
        set.status = 500;
        return { error: 'Failed to load interactive search releases' };
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      query: t.Object({
        season: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/:service/:sourceId/interactive-search/download',
    async ({ user, set, params, body }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const service = params.service === 'radarr' || params.service === 'sonarr' ? params.service : null;
      const sourceId = parseInt(params.sourceId, 10);
      const guid = body.guid.trim();
      const indexerId = body.indexer_id;

      if (!service) {
        set.status = 400;
        return { error: 'Invalid service' };
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        set.status = 400;
        return { error: 'Invalid source ID' };
      }
      if (!guid) {
        set.status = 400;
        return { error: 'Invalid release GUID' };
      }
      if (!Number.isFinite(indexerId) || indexerId <= 0) {
        set.status = 400;
        return { error: 'Invalid indexer ID' };
      }

      try {
        if (service === 'radarr') {
          const plugin = await prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            set.status = 400;
            return { error: 'Radarr plugin is not enabled' };
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            set.status = 400;
            return { error: 'Radarr plugin is not configured' };
          }

          const releaseUrl = new URL('/api/v3/release', config.website_url);
          const commandRes = await fetch(releaseUrl.toString(), {
            method: 'POST',
            headers: {
              'X-Api-Key': config.api_key,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              guid,
              indexerId,
            }),
          });

          if (!commandRes.ok) {
            set.status = 502;
            return { error: `Radarr download release failed with status ${commandRes.status}` };
          }

          return { success: true, service: 'radarr' as const };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          set.status = 400;
          return { error: 'Sonarr plugin is not enabled' };
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          set.status = 400;
          return { error: 'Sonarr plugin is not configured' };
        }

        const releaseUrl = new URL('/api/v3/release', config.website_url);
        const commandRes = await fetch(releaseUrl.toString(), {
          method: 'POST',
          headers: {
            'X-Api-Key': config.api_key,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            guid,
            indexerId,
          }),
        });

        if (!commandRes.ok) {
          set.status = 502;
          return { error: `Sonarr download release failed with status ${commandRes.status}` };
        }

        return { success: true, service: 'sonarr' as const };
      } catch (error) {
        console.error('Error downloading interactive release:', error);
        set.status = 500;
        return { error: 'Failed to download release' };
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      body: t.Object({
        guid: t.String(),
        indexer_id: t.Numeric(),
      }),
    }
  )
  .delete(
    '/:service/:sourceId',
    async ({ user, set, params, query }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const service = params.service === 'radarr' || params.service === 'sonarr' ? params.service : null;
      const sourceId = parseInt(params.sourceId, 10);
      const deleteFiles = query.deleteFiles === 'true';

      if (!service) {
        set.status = 400;
        return { error: 'Invalid service' };
      }
      if (!Number.isFinite(sourceId) || sourceId <= 0) {
        set.status = 400;
        return { error: 'Invalid source ID' };
      }

      try {
        if (service === 'radarr') {
          const plugin = await prisma.plugin.findFirst({
            where: { type: 'radarr' },
            select: { enabled: true, config: true },
          });
          if (!plugin?.enabled) {
            set.status = 400;
            return { error: 'Radarr plugin is not enabled' };
          }

          const config = normalizeRadarrConfig(plugin.config);
          if (!config) {
            set.status = 400;
            return { error: 'Radarr plugin is not configured' };
          }

          const deleteUrl = new URL(`/api/v3/movie/${sourceId}`, config.website_url);
          deleteUrl.searchParams.set('deleteFiles', String(deleteFiles));
          deleteUrl.searchParams.set('addImportExclusion', 'false');

          const deleteRes = await fetch(deleteUrl.toString(), {
            method: 'DELETE',
            headers: {
              'X-Api-Key': config.api_key,
              Accept: 'application/json',
            },
          });

          if (!deleteRes.ok) {
            set.status = 502;
            return { error: `Radarr delete failed with status ${deleteRes.status}` };
          }

          // Invalidate cached Radarr IDs
          await deleteCache('medias:radarr:ids').catch(() => {});

          return { success: true, service: 'radarr' as const };
        }

        const plugin = await prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        });
        if (!plugin?.enabled) {
          set.status = 400;
          return { error: 'Sonarr plugin is not enabled' };
        }

        const config = normalizeSonarrConfig(plugin.config);
        if (!config) {
          set.status = 400;
          return { error: 'Sonarr plugin is not configured' };
        }

        const deleteUrl = new URL(`/api/v3/series/${sourceId}`, config.website_url);
        deleteUrl.searchParams.set('deleteFiles', String(deleteFiles));
        deleteUrl.searchParams.set('addImportExclusion', 'false');

        const deleteRes = await fetch(deleteUrl.toString(), {
          method: 'DELETE',
          headers: {
            'X-Api-Key': config.api_key,
            Accept: 'application/json',
          },
        });

        if (!deleteRes.ok) {
          set.status = 502;
          return { error: `Sonarr delete failed with status ${deleteRes.status}` };
        }

        // Invalidate cached Sonarr IDs
        await deleteCache('medias:sonarr:ids').catch(() => {});

        return { success: true, service: 'sonarr' as const };
      } catch (error) {
        console.error('Error deleting media:', error);
        set.status = 500;
        return { error: 'Failed to delete media' };
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    }
  );
