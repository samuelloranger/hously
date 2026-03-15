import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { prisma } from '../../db';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../../utils/plugins/normalizers';
import { serverError } from '../../utils/errors';
import { getJsonCache, setJsonCache } from '../../services/cache';
import type { MediaItem } from '@hously/shared';
import {
  mapRadarrMovie,
  mapSonarrSeries,
  fetchRadarrDownloadingMovieIds,
  fetchSonarrDownloadingSeriesIds,
} from './mappers';

const LANG_TAGS = /\b(MULTI[._]?VF2|MULTI[._]?VFF|MULTI[._]?VFQ|MULTI|VF2|VFF|VFQ|VFI|TRUEFRENCH|FRENCH)\b/i;
const RESOLUTION_TAGS = /\b(2160p|1080p|720p|480p|4K|UHD)\b/i;
const SOURCE_TAGS = /\b(BluRay|BDRip|BRRip|HDLight|WEBRip|WEB-DL|WEB|HDTV|DVDRip|Remux)\b/i;

function parseReleaseTags(name: string): string[] {
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
    tags.push(name.substring(lastHyphen + 1));
  }

  return tags;
}

export const mediasLibraryRoutes = new Elysia({ prefix: '/api/medias' })
  .use(auth)
  .use(requireUser)
  .get('/', async ({ user, set }) => {
    const response: {
      radarr_enabled: boolean;
      sonarr_enabled: boolean;
      radarr_connected: boolean;
      sonarr_connected: boolean;
      c411_enabled: boolean;
      c411_tmdb_ids: number[];
      c411_release_tags: Record<number, string[]>;
      items: MediaItem[];
      errors?: { radarr?: string; sonarr?: string };
    } = {
      radarr_enabled: false,
      sonarr_enabled: false,
      radarr_connected: false,
      sonarr_connected: false,
      c411_enabled: false,
      c411_tmdb_ids: [],
      c411_release_tags: {},
      items: [],
    };

    const errors: { radarr?: string; sonarr?: string } = {};

    try {
      const [radarrPlugin, sonarrPlugin, c411Plugin] = await Promise.all([
        prisma.plugin.findFirst({
          where: { type: 'radarr' },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: 'sonarr' },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: 'c411' },
          select: { enabled: true },
        }),
      ]);

      response.radarr_enabled = Boolean(radarrPlugin?.enabled);
      response.sonarr_enabled = Boolean(sonarrPlugin?.enabled);
      response.c411_enabled = Boolean(c411Plugin?.enabled);

      // Fetch C411 release data (TMDB IDs + parsed tags) with Redis cache
      if (c411Plugin?.enabled) {
        try {
          const cacheKey = 'c411:library-release-data';
          const cached = await getJsonCache<{ tmdb_ids: number[]; tags: Record<number, string[]> }>(cacheKey);
          if (cached) {
            response.c411_tmdb_ids = cached.tmdb_ids;
            response.c411_release_tags = cached.tags;
          } else {
            const rows = await prisma.$queryRaw<{ tmdb_id: number; name: string }[]>`
              SELECT DISTINCT ON (COALESCE(tmdb_id, (tmdb_data->>'id')::int))
                COALESCE(tmdb_id, (tmdb_data->>'id')::int) AS tmdb_id,
                name
              FROM c411_releases
              WHERE c411_torrent_id IS NOT NULL
                AND (tmdb_id IS NOT NULL OR tmdb_data->>'id' IS NOT NULL)
              ORDER BY COALESCE(tmdb_id, (tmdb_data->>'id')::int), id DESC
            `;
            const tmdbIds: number[] = [];
            const tags: Record<number, string[]> = {};
            for (const r of rows) {
              tmdbIds.push(r.tmdb_id);
              tags[r.tmdb_id] = parseReleaseTags(r.name);
            }
            response.c411_tmdb_ids = tmdbIds;
            response.c411_release_tags = tags;
            await setJsonCache(cacheKey, { tmdb_ids: tmdbIds, tags }, 1800);
          }
        } catch {
          // Non-critical, continue without C411 data
        }
      }

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
      return serverError(set, 'Failed to fetch medias');
    }
  });
