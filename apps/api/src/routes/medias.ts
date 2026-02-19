import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../utils/plugins/normalizers';
import type { MediaItem } from '@hously/shared';

type TmdbSearchItem = {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  release_year: number | null;
  poster_url: string | null;
  service: 'radarr' | 'sonarr';
  already_exists: boolean;
  can_add: boolean;
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
    added_at: toIsoOrNull(row.added),
    tmdb_id: toNumberOrNull(row.tmdbId),
    imdb_id: toStringOrNull(row.imdbId),
    tvdb_id: null,
    season_count: null,
    episode_count: null,
    poster_url: extractPosterUrl(baseUrl, row.images),
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
    added_at: toIsoOrNull(row.added),
    tmdb_id: toNumberOrNull(row.tmdbId),
    imdb_id: toStringOrNull(row.imdbId),
    tvdb_id: toNumberOrNull(row.tvdbId),
    season_count: seasonCount,
    episode_count: episodeCount,
    poster_url: extractPosterUrl(baseUrl, row.images),
  };
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

  return {
    id: `${mediaType}-${tmdbId}`,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title,
    release_year: releaseYear,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : null,
    service: mediaType === 'movie' ? 'radarr' : 'sonarr',
    already_exists: false,
    can_add: false,
  };
};

const fetchRadarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
  const url = new URL('/api/v3/movie', websiteUrl);
  const response = await fetch(url.toString(), {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Radarr request failed with status ${response.status}`);

  const data = (await response.json()) as unknown[];
  const ids = new Set<number>();
  for (const raw of data) {
    const row = toRecord(raw);
    const tmdbId = row ? toNumberOrNull(row.tmdbId) : null;
    if (tmdbId && tmdbId > 0) ids.add(tmdbId);
  }
  return ids;
};

const fetchSonarrTmdbIds = async (websiteUrl: string, apiKey: string): Promise<Set<number>> => {
  const url = new URL('/api/v3/series', websiteUrl);
  const response = await fetch(url.toString(), {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Sonarr request failed with status ${response.status}`);

  const data = (await response.json()) as unknown[];
  const ids = new Set<number>();
  for (const raw of data) {
    const row = toRecord(raw);
    const tmdbId = row ? toNumberOrNull(row.tmdbId) : null;
    if (tmdbId && tmdbId > 0) ids.add(tmdbId);
  }
  return ids;
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
          const radarrRes = await fetch(radarrUrl.toString(), {
            headers: {
              'X-Api-Key': radarrConfig.api_key,
              Accept: 'application/json',
            },
          });

          if (!radarrRes.ok) {
            errors.radarr = `Radarr request failed with status ${radarrRes.status}`;
          } else {
            const movies = (await radarrRes.json()) as unknown[];
            response.radarr_connected = true;
            response.items.push(
              ...movies
                .map(movie => mapRadarrMovie(movie, radarrConfig.website_url))
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
          const sonarrRes = await fetch(sonarrUrl.toString(), {
            headers: {
              'X-Api-Key': sonarrConfig.api_key,
              Accept: 'application/json',
            },
          });

          if (!sonarrRes.ok) {
            errors.sonarr = `Sonarr request failed with status ${sonarrRes.status}`;
          } else {
            const series = (await sonarrRes.json()) as unknown[];
            response.sonarr_connected = true;
            response.items.push(
              ...series
                .map(show => mapSonarrSeries(show, sonarrConfig.website_url))
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

      const tmdbApiKey = process.env.TMDB_API_KEY?.trim();
      if (!tmdbApiKey) {
        set.status = 400;
        return { error: 'TMDB is not configured' };
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

        const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
        const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;
        response.radarr_enabled = Boolean(radarrConfig);
        response.sonarr_enabled = Boolean(sonarrConfig);

        const searchUrl = new URL('https://api.themoviedb.org/3/search/multi');
        searchUrl.searchParams.set('api_key', tmdbApiKey);
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

        let radarrIds = new Set<number>();
        let sonarrIds = new Set<number>();

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
          return {
            ...item,
            already_exists: isMovie ? radarrIds.has(item.tmdb_id) : sonarrIds.has(item.tmdb_id),
            can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
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
  );
