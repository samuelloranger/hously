/**
 * TMDB detail fetching for C411 BBCode generation.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

export interface TmdbDetails {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  originalTitle: string;
  year: string;
  overview: string;
  genres: string[];
  runtime: string;
  director: string;
  cast: string[];
  posterUrl: string;
  backdropUrl: string;
  rating: string;
  productionCountries: string[];
  releaseDate: string;
  imdbId: string;
  seasons?: number;
  episodes?: number;
  status?: string;
  network?: string;
  creators?: string[];
}

async function tmdbFetch(apiKey: string, path: string, params: Record<string, string> = {}) {
  const p = new URLSearchParams({ api_key: apiKey, language: 'fr-FR', ...params });
  const res = await fetch(`${TMDB_BASE}${path}?${p}`);
  return res.json() as Promise<any>;
}

function formatRuntime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }
  return `${minutes}min`;
}

export async function fetchTmdbDetails(apiKey: string, type: 'movie' | 'tv', id: number): Promise<TmdbDetails> {
  const [details, credits, externalIds] = await Promise.all([
    tmdbFetch(apiKey, `/${type}/${id}`),
    tmdbFetch(apiKey, `/${type}/${id}/credits`),
    tmdbFetch(apiKey, `/${type}/${id}/external_ids`),
  ]);

  const genres = (details.genres ?? []).map((g: any) => g.name);
  const cast = (credits.cast ?? []).slice(0, 8).map((c: any) => c.name);
  const posterUrl = details.poster_path ? `${TMDB_IMG}/w500${details.poster_path}` : '';
  const backdropUrl = details.backdrop_path ? `${TMDB_IMG}/w1280${details.backdrop_path}` : '';
  const imdbId = externalIds.imdb_id ?? '';

  if (type === 'movie') {
    const directors = (credits.crew ?? []).filter((c: any) => c.job === 'Director').map((c: any) => c.name);
    const runtime = details.runtime ? formatRuntime(details.runtime) : 'N/A';
    const releaseDate = details.release_date ?? '';
    const releaseYear = releaseDate ? releaseDate.split('-')[0] : '';
    return {
      id, type: 'movie', title: details.title ?? '', originalTitle: details.original_title ?? '',
      year: releaseYear, overview: details.overview ?? '', genres, runtime,
      director: directors.join(', ') || 'N/A', cast, posterUrl, backdropUrl,
      rating: details.vote_average ? `${details.vote_average.toFixed(1)}/10` : 'N/A',
      productionCountries: (details.production_countries ?? []).map((c: any) => c.name),
      releaseDate, imdbId,
    };
  }

  // TV
  const creators = (details.created_by ?? []).map((c: any) => c.name);
  const firstAir = details.first_air_date ?? '';
  const firstYear = firstAir ? firstAir.split('-')[0] : '';
  const episodeRuntime = details.episode_run_time?.[0];
  const runtime = episodeRuntime ? formatRuntime(episodeRuntime) : 'N/A';
  const network = (details.networks ?? [])[0]?.name ?? 'N/A';

  const statusMap: Record<string, string> = {
    'Returning Series': 'En cours', Ended: 'Terminee', Canceled: 'Annulee', 'In Production': 'En production',
  };

  const countryNames = (details.origin_country ?? []).map((code: string) => {
    const map: Record<string, string> = {
      CA: 'Canada', US: 'United States', FR: 'France', GB: 'United Kingdom',
      DE: 'Germany', JP: 'Japan', KR: 'South Korea', AU: 'Australia',
    };
    return map[code] ?? code;
  });

  return {
    id, type: 'tv', title: details.name ?? '', originalTitle: details.original_name ?? '',
    year: firstYear, overview: details.overview ?? '', genres, runtime,
    director: creators.join(', ') || '', cast, posterUrl, backdropUrl,
    rating: details.vote_average ? `${details.vote_average.toFixed(1)}/10` : 'N/A',
    productionCountries: countryNames, releaseDate: firstAir, imdbId,
    seasons: details.number_of_seasons, episodes: details.number_of_episodes,
    status: statusMap[details.status] ?? details.status ?? 'N/A', network, creators,
  };
}

export function parseReleaseName(name: string): { title: string; year: string } {
  let clean = name.replace(/\.[^.]+$/, '');
  const yearMatch = clean.match(/(19|20)\d{2}/);
  const year = yearMatch?.[0] ?? '';
  let title: string;
  if (year) {
    title = clean.replace(new RegExp(`[\\s.\\-_]*[\\(\\[]?${year}.*`), '');
  } else {
    title = clean.replace(
      /[.\-_ ](MULTi|FRENCH|VOSTFR|VFF|VFQ|TRUEFRENCH|1080p|720p|2160p|4K|BluRay|WEB|HDRip|BDRip|HDTV|x26[45]|HEVC|S\d{2}|iNTEGRALE|Integrale|Saison|Season).*/i,
      '',
    );
  }
  title = title.replace(/[._]/g, ' ').replace(/\s*-\s*$/, '').trim().replace(/\s+/g, ' ');
  return { title, year };
}

export function isTvShow(name: string): boolean {
  return /S\d{2}|Saison|Season|Complete|Int[eé]grale/i.test(name);
}

export async function searchAndFetchTmdbDetails(apiKey: string, releaseName: string): Promise<TmdbDetails | null> {
  const { title, year } = parseReleaseName(releaseName);
  if (!title) return null;
  const isTV = isTvShow(releaseName);
  const type = isTV ? 'tv' : 'movie';

  const searchParams: Record<string, string> = { query: title };
  if (year) searchParams[type === 'movie' ? 'year' : 'first_air_date_year'] = year;
  const search = await tmdbFetch(apiKey, `/search/${type}`, searchParams);
  let result = search.results?.[0];

  if (!result) {
    const altType = isTV ? 'movie' : 'tv';
    const altParams: Record<string, string> = { query: title };
    if (year) altParams[altType === 'movie' ? 'year' : 'first_air_date_year'] = year;
    const altSearch = await tmdbFetch(apiKey, `/search/${altType}`, altParams);
    result = altSearch.results?.[0];
    if (!result) return null;
    return fetchTmdbDetails(apiKey, altType as 'movie' | 'tv', result.id);
  }
  return fetchTmdbDetails(apiKey, type, result.id);
}

export function buildFallbackTmdbDetails(releaseName: string): TmdbDetails {
  const { title, year } = parseReleaseName(releaseName);
  const guessedType = isTvShow(releaseName) ? 'tv' : 'movie';
  return {
    id: 0, type: guessedType, title: title || releaseName, originalTitle: title || releaseName,
    year: year || '', overview: 'Description indisponible.', genres: [], runtime: 'N/A',
    director: 'N/A', cast: [], posterUrl: '', backdropUrl: '', rating: 'N/A',
    productionCountries: [], releaseDate: '', imdbId: '',
  };
}
