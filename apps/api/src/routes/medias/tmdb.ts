import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { prisma } from '../../db';
import {
  normalizeRadarrConfig,
  normalizeSonarrConfig,
  normalizeTmdbConfig,
} from '../../utils/plugins/normalizers';
import { getJsonCache, setJsonCache } from '../../services/cache';
import { badGateway, badRequest, serverError } from '../../utils/errors';
import {
  type TmdbSearchItem,
  type TmdbProvider,
  type TmdbWatchProvidersResult,
  type ArrEntry,
  mapTmdbSearchItem,
  fetchRadarrTmdbIds,
  fetchSonarrTmdbIds,
  buildArrItemUrl,
  toRecord,
  toStringOrNull,
  toNumberOrNull,
} from './mappers';

export const mediasTmdbRoutes = new Elysia({ prefix: '/api/medias' })
  .use(auth)
  .use(requireUser)
  .get(
    '/tmdb-search',
    async ({ user, set, query }) => {
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
          return badRequest(set, 'TMDB is not configured');
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
          return badGateway(set, `TMDB search failed with status ${searchRes.status}`);
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
        return serverError(set, 'Failed to search TMDB medias');
      }
    },
    {
      query: t.Object({
        q: t.String(),
      }),
    }
  )
  .get('/explore', async ({ user, set, query }) => {
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
        return badRequest(set, 'TMDB is not configured');
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
      return serverError(set, 'Failed to fetch TMDB explore');
    }
  })
  .get('/explore/:category', async ({ user, set, params, query }) => {
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
      return badRequest(set, `Unknown category: ${category}`);
    }

    try {
      const [tmdbPlugin, radarrPlugin, sonarrPlugin] = await Promise.all([
        prisma.plugin.findFirst({ where: { type: 'tmdb' }, select: { enabled: true, config: true } }),
        prisma.plugin.findFirst({ where: { type: 'radarr' }, select: { enabled: true, config: true } }),
        prisma.plugin.findFirst({ where: { type: 'sonarr' }, select: { enabled: true, config: true } }),
      ]);

      const tmdbConfig = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config) : null;
      if (!tmdbConfig) {
        return badRequest(set, 'TMDB is not configured');
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
        return badGateway(set, 'TMDB request failed');
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
      return serverError(set, 'Failed to fetch category');
    }
  })
  .get(
    '/similar/:tmdbId',
    async ({ user, set, params, query: queryParams }) => {
      const tmdbId = parseInt(params.tmdbId, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
        return badRequest(set, 'Invalid TMDB ID');
      }

      const typedQuery = queryParams as Record<string, string | undefined>;
      const mediaType = typedQuery.type;
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        return badRequest(set, 'Invalid type, must be movie or tv');
      }

      const language = typedQuery.language || 'en-US';

      try {
        const cacheKey = `medias:recommendations:${mediaType}:${tmdbId}:${language}`;
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
          return badRequest(set, 'TMDB is not configured');
        }

        const radarrConfig = radarrPlugin?.enabled ? normalizeRadarrConfig(radarrPlugin.config) : null;
        const sonarrConfig = sonarrPlugin?.enabled ? normalizeSonarrConfig(sonarrPlugin.config) : null;

        const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/recommendations`);
        url.searchParams.set('api_key', tmdbConfig.api_key);
        url.searchParams.set('language', language);
        const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        const rawResults: unknown[] = [];
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          if (Array.isArray(data.results)) rawResults.push(...data.results);
        }

        // Inject media_type for consistency (recommendations may not always include it)
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
          .slice(0, 40);

        await setJsonCache(cacheKey, items, 60 * 60); // 1 hour
        return { items };
      } catch (error) {
        console.error('Error fetching similar medias:', error);
        return serverError(set, 'Failed to fetch similar medias');
      }
    },
    {
      params: t.Object({ tmdbId: t.String() }),
    }
  )
  .get(
    '/providers/:mediaType/:tmdbId',
    async ({ user, set, params, query: queryParams }) => {
      const { mediaType, tmdbId: tmdbIdStr } = params;
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        return badRequest(set, 'Invalid media type');
      }

      const tmdbId = parseInt(tmdbIdStr, 10);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
        return badRequest(set, 'Invalid TMDB ID');
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
  );
