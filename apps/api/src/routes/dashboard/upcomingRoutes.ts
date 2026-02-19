import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import {
  TMDB_UPCOMING_CACHE_TTL_SECONDS,
  collectTmdbUpcoming,
  fetchJellyfinTmdbIds,
  fetchTmdbProviders,
  getArrPluginStatus,
  parseTmdbNumericId,
  toIsoDate,
} from '../../utils/dashboard/tmdbUpcoming';
import { prisma } from '../../db';
import { getJsonCache, setJsonCache } from '../../services/cache';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../../utils/plugins/normalizers';
import { toPositiveInt, toRecord } from '../../utils/coerce';
import type { DashboardUpcomingItem } from '../../types/dashboardUpcoming';

export const dashboardUpcomingRoutes = new Elysia()
  .use(auth)
  .get(
    '/upcoming/swipe',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const arrPluginStatus = await getArrPluginStatus();
        const tmdbApiKey = process.env.TMDB_API_KEY?.trim();
        if (!tmdbApiKey) {
          return { enabled: false, items: [], ...arrPluginStatus };
        }

        const requestedLimit = toPositiveInt(query.limit, 24);
        const limit = Math.max(1, Math.min(60, requestedLimit));
        const poolSizePerType = Math.max(120, Math.min(400, limit * 10));

        const today = new Date();
        const todayIso = toIsoDate(today);
        const oneYearOut = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
        const oneYearOutIso = toIsoDate(oneYearOut);
        // const cacheKey = `dashboard:tmdb:swipe:v5:from:${todayIso}:pool:${poolSizePerType}`;

        // const cached = await getJsonCache<{
        //   enabled: boolean;
        //   items: DashboardUpcomingItem[];
        // }>(cacheKey);

        let resolvedRawItems: DashboardUpcomingItem[] | null = null;
        if (!resolvedRawItems) {
          resolvedRawItems = await (async () => {
            const [moviesResult, tvResult] = await Promise.all([
              collectTmdbUpcoming('movie', poolSizePerType, tmdbApiKey, todayIso, oneYearOutIso),
              collectTmdbUpcoming('tv', poolSizePerType, tmdbApiKey, todayIso, oneYearOutIso),
            ]);

            if (!moviesResult || !tvResult) {
              set.status = 502;
              return null;
            }

            const sortedItems = [...moviesResult.items, ...tvResult.items]
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

            // await setJsonCache(
            //   cacheKey,
            //   {
            //     enabled: true,
            //     items: sortedItems,
            //   },
            //   TMDB_UPCOMING_CACHE_TTL_SECONDS
            // );
            return sortedItems;
          })();
        }

        if (!resolvedRawItems) {
          return { error: 'TMDB request failed' };
        }

        const jellyfinTmdbIds = await fetchJellyfinTmdbIds();
        const filteredItems = resolvedRawItems
          .filter(item => {
            const tmdbId = parseTmdbNumericId(item.id);
            if (!tmdbId) return false;
            return !jellyfinTmdbIds.has(tmdbId);
          })
          .slice(0, limit);

        return {
          enabled: true,
          items: filteredItems,
          ...arrPluginStatus,
        };
      } catch (error) {
        console.error('Error getting TMDB swipe items:', error);
        set.status = 500;
        return { error: 'Failed to get TMDB swipe items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get('/upcoming', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const arrPluginStatus = await getArrPluginStatus();
      const tmdbApiKey = process.env.TMDB_API_KEY?.trim();

      if (!tmdbApiKey) {
        return { enabled: false, items: [], ...arrPluginStatus };
      }

      const today = new Date();
      const todayIso = toIsoDate(today);
      const oneYearOut = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
      const oneYearOutIso = toIsoDate(oneYearOut);
      const cacheKey = `dashboard:tmdb:upcoming:v5:from:${todayIso}`;

      const cached = await getJsonCache<{
        enabled: boolean;
        items: DashboardUpcomingItem[];
      }>(cacheKey);
      if (cached) {
        return { ...cached, ...arrPluginStatus };
      }

      const POOL_SIZE_PER_TYPE = 60; // ~3 TMDB pages per media type → ~120 items total
      const [moviesResult, tvResult] = await Promise.all([
        collectTmdbUpcoming('movie', POOL_SIZE_PER_TYPE, tmdbApiKey, todayIso, oneYearOutIso),
        collectTmdbUpcoming('tv', POOL_SIZE_PER_TYPE, tmdbApiKey, todayIso, oneYearOutIso),
      ]);

      if (!moviesResult || !tvResult) {
        set.status = 502;
        return { error: 'TMDB request failed' };
      }

      const sortedItems = [...moviesResult.items, ...tvResult.items]
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

      const itemsWithProviders = await Promise.all(
        sortedItems.map(async item => {
          const tmdbId = parseTmdbNumericId(item.id);
          if (!tmdbId) return item;
          const providers = await fetchTmdbProviders(item.media_type, tmdbId, tmdbApiKey);
          return { ...item, providers };
        })
      );

      const responsePayload = { enabled: true, items: itemsWithProviders };
      await setJsonCache(cacheKey, responsePayload, TMDB_UPCOMING_CACHE_TTL_SECONDS);
      return { ...responsePayload, ...arrPluginStatus };
    } catch (error) {
      console.error('Error getting TMDB upcoming items:', error);
      set.status = 500;
      return { error: 'Failed to get TMDB upcoming items' };
    }
  })
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
  );
