import { Elysia } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { prisma } from '../../db';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../../utils/plugins/normalizers';
import { serverError } from '../../utils/errors';
import type { MediaItem } from '@hously/shared';
import {
  mapRadarrMovie,
  mapSonarrSeries,
  fetchRadarrDownloadingMovieIds,
  fetchSonarrDownloadingSeriesIds,
  fetchSonarrSeriesReleaseTags,
} from './mappers';

export const mediasLibraryRoutes = new Elysia({ prefix: '/api/medias' })
  .use(auth)
  .use(requireUser)
  .get('/', async ({ user, set }) => {
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
              const sonarrItems = series
                .map(show => {
                  const item = mapSonarrSeries(show, sonarrConfig.website_url);
                  if (!item) return null;
                  return {
                    ...item,
                    downloading: !item.downloaded && queueIds.has(item.source_id),
                  };
                })
                .filter((item): item is MediaItem => Boolean(item));

              // Fetch release tags from episode files (cached per series)
              const downloadedIds = sonarrItems.filter(i => i.downloaded).map(i => i.source_id);
              const tagMap = await fetchSonarrSeriesReleaseTags(
                sonarrConfig.website_url,
                sonarrConfig.api_key,
                downloadedIds
              ).catch(() => new Map<number, string[]>());

              for (const item of sonarrItems) {
                const tags = tagMap.get(item.source_id);
                if (tags) item.release_tags = tags;
              }

              response.items.push(...sonarrItems);
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
