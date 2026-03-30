import { getJsonCache, setJsonCache } from '../../services/cache';
import { prisma } from '../../db';
import { normalizeTmdbConfig } from '../../utils/plugins/normalizers';
import { toRecord, toStringOrNull, type TmdbProvider, type TmdbWatchProvidersResult } from './mappers';

// ── Return types ────────────────────────────────────────────────────────────

export type TrailerResult = {
  key: string | null;
  name: string | null;
};

export type RatingsResult = {
  imdb_rating: string | null;
  rotten_tomatoes: string | null;
  metacritic: string | null;
};

export type CreditsResult = {
  cast: { id: number; name: string; character: string | null; profile_url: string | null }[];
  directors: string[];
};

export type DetailsResult = {
  runtime: number | null;
  belongs_to_collection: { id: number; name: string; poster_url: string | null } | null;
  overview: string | null;
  vote_average: number | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
};

// ── Config loader ────────────────────────────────────────────────────────────

export async function loadTmdbConfig() {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'tmdb' },
    select: { enabled: true, config: true },
  });
  return plugin?.enabled ? normalizeTmdbConfig(plugin.config) : null;
}

// ── Low-level TMDB fetch ─────────────────────────────────────────────────────

function makeTmdbFetch(apiKey: string) {
  return async (path: string): Promise<Record<string, unknown> | null> => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('language', 'en-US');
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return res.json() as Promise<Record<string, unknown>>;
  };
}

// ── Individual fetchers ──────────────────────────────────────────────────────

export async function fetchTrailer(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<TrailerResult> {
  const cacheKey = `medias:trailer:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<TrailerResult>(cacheKey);
  if (cached) return cached;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}/videos`);
    const results = Array.isArray(data?.results) ? (data!.results as Record<string, unknown>[]) : [];
    const youtube = results.filter(v => v.site === 'YouTube');
    const pick =
      youtube.find(v => v.official && v.type === 'Trailer') ??
      youtube.find(v => v.official && v.type === 'Teaser') ??
      youtube.find(v => v.type === 'Trailer') ??
      youtube.find(v => v.type === 'Teaser') ??
      youtube[0] ??
      null;
    const result: TrailerResult = {
      key: pick ? toStringOrNull(pick.key) : null,
      name: pick ? toStringOrNull(pick.name) : null,
    };
    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return { key: null, name: null };
  }
}

export async function fetchRatings(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<RatingsResult> {
  const cacheKey = `medias:ratings:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<RatingsResult>(cacheKey);
  if (cached) return cached;

  const empty: RatingsResult = { imdb_rating: null, rotten_tomatoes: null, metacritic: null };
  const omdbKey = Bun.env.OMDB_API_KEY;
  if (!omdbKey) return empty;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const extData = await tmdbFetch(`${mediaType}/${tmdbId}/external_ids`);
    const imdbId = typeof extData?.imdb_id === 'string' ? extData.imdb_id : null;
    if (!imdbId) return empty;

    const omdbUrl = new URL('https://www.omdbapi.com/');
    omdbUrl.searchParams.set('i', imdbId);
    omdbUrl.searchParams.set('apikey', omdbKey);
    const res = await fetch(omdbUrl.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return empty;

    const data = (await res.json()) as Record<string, unknown>;
    if (data.Response === 'False') return empty;

    const ratings = Array.isArray(data.Ratings) ? (data.Ratings as { Source: string; Value: string }[]) : [];
    const rtRaw = ratings.find(r => r.Source === 'Rotten Tomatoes')?.Value ?? null;
    const mcRaw = ratings.find(r => r.Source === 'Metacritic')?.Value?.replace('/100', '') ?? null;
    const result: RatingsResult = {
      imdb_rating: typeof data.imdbRating === 'string' && data.imdbRating !== 'N/A' ? data.imdbRating : null,
      rotten_tomatoes: rtRaw && rtRaw !== 'N/A' && rtRaw !== '0%' ? rtRaw : null,
      metacritic: mcRaw && mcRaw !== 'N/A' && mcRaw !== '0' ? mcRaw : null,
    };
    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return empty;
  }
}

export async function fetchCredits(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<CreditsResult> {
  const cacheKey = `medias:credits:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<CreditsResult>(cacheKey);
  if (cached) return cached;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}/credits`);
    const castArr = Array.isArray(data?.cast) ? (data!.cast as Record<string, unknown>[]) : [];
    const crewArr = Array.isArray(data?.crew) ? (data!.crew as Record<string, unknown>[]) : [];
    const result: CreditsResult = {
      cast: castArr.slice(0, 10).map(m => ({
        id: typeof m.id === 'number' ? m.id : 0,
        name: typeof m.name === 'string' ? m.name : '',
        character: typeof m.character === 'string' ? m.character : null,
        profile_url:
          typeof m.profile_path === 'string' && m.profile_path
            ? `https://image.tmdb.org/t/p/w185${m.profile_path}`
            : null,
      })),
      directors: crewArr
        .filter(m => m.job === 'Director')
        .map(m => (typeof m.name === 'string' ? m.name : ''))
        .filter(Boolean),
    };
    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return { cast: [], directors: [] };
  }
}

export async function fetchMediaDetails(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<DetailsResult> {
  const cacheKey = `medias:tmdb-details:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<DetailsResult>(cacheKey);
  if (cached) return cached;

  const empty: DetailsResult = {
    runtime: null,
    belongs_to_collection: null,
    overview: null,
    vote_average: null,
    number_of_seasons: null,
    number_of_episodes: null,
  };
  const tmdbFetch = makeTmdbFetch(apiKey);

  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}`);
    if (!data) return empty;

    const overview = typeof data.overview === 'string' ? data.overview || null : null;
    const vote_average = typeof data.vote_average === 'number' ? data.vote_average : null;
    let runtime: number | null = null;
    let belongs_to_collection: DetailsResult['belongs_to_collection'] = null;
    let number_of_seasons: number | null = null;
    let number_of_episodes: number | null = null;

    if (mediaType === 'movie') {
      runtime = typeof data.runtime === 'number' ? data.runtime : null;
      const col = data.belongs_to_collection as Record<string, unknown> | null;
      if (col && typeof col === 'object') {
        belongs_to_collection = {
          id: typeof col.id === 'number' ? col.id : 0,
          name: typeof col.name === 'string' ? col.name : '',
          poster_url:
            typeof col.poster_path === 'string' && col.poster_path
              ? `https://image.tmdb.org/t/p/w185${col.poster_path}`
              : null,
        };
      }
    } else {
      const episodeRunTime = Array.isArray(data.episode_run_time) ? (data.episode_run_time as number[]) : [];
      runtime = episodeRunTime.length > 0 ? episodeRunTime[0] : null;
      number_of_seasons = typeof data.number_of_seasons === 'number' ? data.number_of_seasons : null;
      number_of_episodes = typeof data.number_of_episodes === 'number' ? data.number_of_episodes : null;
    }

    const result: DetailsResult = { runtime, belongs_to_collection, overview, vote_average, number_of_seasons, number_of_episodes };
    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return empty;
  }
}

export type CollectionPart = {
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  overview: string | null;
  vote_average: number | null;
};

export type TmdbCollectionData = {
  id: number;
  name: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  parts: CollectionPart[];
};

export async function fetchCollectionDetails(
  apiKey: string,
  collectionId: number,
): Promise<TmdbCollectionData | null> {
  const cacheKey = `medias:collection:${collectionId}`;
  const cached = await getJsonCache<TmdbCollectionData>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`https://api.themoviedb.org/3/collection/${collectionId}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('language', 'en-US');
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
    const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

    const parts = Array.isArray(data.parts) ? (data.parts as Record<string, unknown>[]) : [];
    const result: TmdbCollectionData = {
      id: typeof data.id === 'number' ? data.id : collectionId,
      name: typeof data.name === 'string' ? data.name : '',
      overview: typeof data.overview === 'string' ? data.overview || null : null,
      poster_url: typeof data.poster_path === 'string' && data.poster_path ? `${POSTER_BASE}${data.poster_path}` : null,
      backdrop_url: typeof data.backdrop_path === 'string' && data.backdrop_path ? `${BACKDROP_BASE}${data.backdrop_path}` : null,
      parts: parts
        .map(p => {
          const tmdb_id = typeof p.id === 'number' ? p.id : null;
          if (!tmdb_id) return null;
          const dateStr = typeof p.release_date === 'string' ? p.release_date : '';
          const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
          return {
            tmdb_id,
            title: typeof p.title === 'string' ? p.title : '',
            release_year: year && !isNaN(year) ? year : null,
            poster_url: typeof p.poster_path === 'string' && p.poster_path ? `${POSTER_BASE}${p.poster_path}` : null,
            overview: typeof p.overview === 'string' ? p.overview || null : null,
            vote_average: typeof p.vote_average === 'number' ? p.vote_average : null,
          } satisfies CollectionPart;
        })
        .filter((p): p is CollectionPart => p !== null)
        .sort((a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999)),
    };

    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return null;
  }
}

export async function fetchWatchProviders(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  region: string,
): Promise<TmdbWatchProvidersResult> {
  const cacheKey = `medias:providers:${mediaType}:${tmdbId}:${region}`;
  const cached = await getJsonCache<TmdbWatchProvidersResult>(cacheKey);
  if (cached) return cached;

  const LOGO_BASE = 'https://image.tmdb.org/t/p/w92';
  const empty: TmdbWatchProvidersResult = { region, streaming: [], free: [], rent: [], buy: [], link: null };

  try {
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`);
    url.searchParams.set('api_key', apiKey);
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return empty;

    const data = (await res.json()) as Record<string, unknown>;
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
      streaming: regionData ? mapProviders(Array.isArray(regionData.flatrate) ? (regionData.flatrate as unknown[]) : []) : [],
      free: regionData ? mapProviders(Array.isArray(regionData.free) ? (regionData.free as unknown[]) : []) : [],
      rent: regionData ? mapProviders(Array.isArray(regionData.rent) ? (regionData.rent as unknown[]) : []) : [],
      buy: regionData ? mapProviders(Array.isArray(regionData.buy) ? (regionData.buy as unknown[]) : []) : [],
      link: regionData ? toStringOrNull(regionData.link) : null,
    };
    await setJsonCache(cacheKey, result, 6 * 60 * 60);
    return result;
  } catch {
    return empty;
  }
}
