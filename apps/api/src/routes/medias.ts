import { Elysia } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../utils/plugins/normalizers';

type MediaItem = {
  id: string;
  media_type: 'movie' | 'series';
  service: 'radarr' | 'sonarr';
  source_id: number;
  title: string;
  sort_title: string | null;
  year: number | null;
  status: string | null;
  monitored: boolean;
  downloaded: boolean;
  added_at: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  tvdb_id: number | null;
  season_count: number | null;
  episode_count: number | null;
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

const mapRadarrMovie = (raw: unknown): MediaItem | null => {
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
  };
};

const mapSonarrSeries = (raw: unknown): MediaItem | null => {
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
  };
};

export const mediasRoutes = new Elysia({ prefix: '/api/medias' }).use(auth).get('/', async ({ user, set }) => {
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
            response.items.push(...movies.map(mapRadarrMovie).filter((item): item is MediaItem => Boolean(item)));
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
            response.items.push(...series.map(mapSonarrSeries).filter((item): item is MediaItem => Boolean(item)));
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
});
