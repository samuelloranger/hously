import { getJsonCache, setJsonCache } from "../../services/cache";
import { prisma } from "../../db";
import { normalizeTmdbConfig } from "../../utils/plugins/normalizers";
import type {
  TmdbCreator,
  TmdbExternalIds,
  TmdbGenre,
  TmdbImageStill,
  TmdbMediaDetailsResponse,
  TmdbMediaStills,
  TmdbNetwork,
  TmdbNextEpisode,
  TmdbProductionCompany,
  TmdbProductionCountry,
  TmdbSeasonSummary,
  TmdbSpokenLanguage,
} from "@hously/shared";
import {
  toNumberOrNull,
  toRecord,
  toStringOrNull,
  type TmdbProvider,
  type TmdbWatchProvidersResult,
} from "./mappers";

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
  cast: {
    id: number;
    name: string;
    character: string | null;
    profile_url: string | null;
  }[];
  directors: string[];
};

export type DetailsResult = TmdbMediaDetailsResponse;

const IMG_BACKDROP = "https://image.tmdb.org/t/p/w1280";
const IMG_BACKDROP_STILL = "https://image.tmdb.org/t/p/w780";
const IMG_POSTER_STILL = "https://image.tmdb.org/t/p/w342";
const IMG_LOGO_STILL = "https://image.tmdb.org/t/p/w185";
const IMG_COMPANY = "https://image.tmdb.org/t/p/w92";
const IMG_PROFILE = "https://image.tmdb.org/t/p/w185";

export function emptyMediaDetails(): TmdbMediaDetailsResponse {
  return {
    runtime: null,
    belongs_to_collection: null,
    overview: null,
    vote_average: null,
    number_of_seasons: null,
    number_of_episodes: null,
    release_date: null,
    tagline: null,
    genres: [],
    first_air_date: null,
    last_air_date: null,
    status: null,
    original_title: null,
    original_language: null,
    original_language_label: null,
    production_countries: [],
    production_companies: [],
    spoken_languages: [],
    budget: null,
    revenue: null,
    homepage: null,
    external_ids: null,
    primary_backdrop_url: null,
    media_stills: { backdrops: [], logos: [], posters: [] },
    tv_type: null,
    networks: [],
    created_by: [],
    episode_run_times: [],
    next_episode_to_air: null,
    last_episode_to_air: null,
    seasons: [],
  };
}

function parseYmd(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseExternalIds(raw: unknown): TmdbExternalIds | null {
  const row = toRecord(raw);
  if (!row) return null;
  return {
    imdb_id: toStringOrNull(row.imdb_id),
    facebook_id: toStringOrNull(row.facebook_id),
    instagram_id: toStringOrNull(row.instagram_id),
    twitter_id: toStringOrNull(row.twitter_id),
    wikidata_id: toStringOrNull(row.wikidata_id),
  };
}

function parseImageStills(
  images: unknown,
  kind: "backdrop" | "poster" | "logo",
): TmdbImageStill[] {
  const root = toRecord(images);
  if (!root) return [];
  const key =
    kind === "backdrop" ? "backdrops" : kind === "poster" ? "posters" : "logos";
  const arr = Array.isArray(root[key]) ? (root[key] as unknown[]) : [];
  const size =
    kind === "backdrop"
      ? IMG_BACKDROP_STILL
      : kind === "poster"
        ? IMG_POSTER_STILL
        : IMG_LOGO_STILL;
  const mapped: TmdbImageStill[] = [];
  for (const raw of arr) {
    const r = toRecord(raw);
    if (!r) continue;
    const path = toStringOrNull(r.file_path);
    if (!path) continue;
    mapped.push({
      url: `${size}${path}`,
      width: toNumberOrNull(r.width),
      height: toNumberOrNull(r.height),
      vote_average: typeof r.vote_average === "number" ? r.vote_average : null,
    });
  }
  mapped.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  return mapped.slice(0, 12);
}

function parseNextEpisode(raw: unknown): TmdbNextEpisode | null {
  const row = toRecord(raw);
  if (!row) return null;
  const air = parseYmd(row.air_date);
  const ep: TmdbNextEpisode = {
    name: toStringOrNull(row.name),
    air_date: air,
    episode_number: toNumberOrNull(row.episode_number),
    season_number: toNumberOrNull(row.season_number),
    runtime: toNumberOrNull(row.runtime),
  };
  if (
    !ep.name &&
    !ep.air_date &&
    ep.episode_number == null &&
    ep.season_number == null &&
    ep.runtime == null
  ) {
    return null;
  }
  return ep;
}

function languageLabel(
  iso: string | null,
  spoken: TmdbSpokenLanguage[],
): string | null {
  if (!iso) return null;
  const match = spoken.find((s) => s.iso_639_1 === iso);
  if (match) return match.english_name || match.name;
  const map: Record<string, string> = {
    en: "English",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
  };
  return map[iso] ?? iso.toUpperCase();
}

// ── Config loader ────────────────────────────────────────────────────────────

export async function loadTmdbConfig() {
  const plugin = await prisma.plugin.findFirst({
    where: { type: "tmdb" },
    select: { enabled: true, config: true },
  });
  return plugin?.enabled ? normalizeTmdbConfig(plugin.config) : null;
}

// ── Low-level TMDB fetch ─────────────────────────────────────────────────────

function makeTmdbFetch(apiKey: string) {
  return async (
    path: string,
    extraParams?: Record<string, string | undefined>,
  ): Promise<Record<string, unknown> | null> => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "en-US");
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v != null && v !== "") url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<Record<string, unknown>>;
  };
}

// ── Individual fetchers ──────────────────────────────────────────────────────

export async function fetchTrailer(
  apiKey: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TrailerResult> {
  const cacheKey = `medias:trailer:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<TrailerResult>(cacheKey);
  if (cached) return cached;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}/videos`);
    const results = Array.isArray(data?.results)
      ? (data!.results as Record<string, unknown>[])
      : [];
    const youtube = results.filter((v) => v.site === "YouTube");
    const pick =
      youtube.find((v) => v.official && v.type === "Trailer") ??
      youtube.find((v) => v.official && v.type === "Teaser") ??
      youtube.find((v) => v.type === "Trailer") ??
      youtube.find((v) => v.type === "Teaser") ??
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
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<RatingsResult> {
  const cacheKey = `medias:ratings:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<RatingsResult>(cacheKey);
  if (cached) return cached;

  const empty: RatingsResult = {
    imdb_rating: null,
    rotten_tomatoes: null,
    metacritic: null,
  };
  const omdbKey = Bun.env.OMDB_API_KEY;
  if (!omdbKey) return empty;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const extData = await tmdbFetch(`${mediaType}/${tmdbId}/external_ids`);
    const imdbId =
      typeof extData?.imdb_id === "string" ? extData.imdb_id : null;
    if (!imdbId) return empty;

    const omdbUrl = new URL("https://www.omdbapi.com/");
    omdbUrl.searchParams.set("i", imdbId);
    omdbUrl.searchParams.set("apikey", omdbKey);
    const res = await fetch(omdbUrl.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return empty;

    const data = (await res.json()) as Record<string, unknown>;
    if (data.Response === "False") return empty;

    const ratings = Array.isArray(data.Ratings)
      ? (data.Ratings as { Source: string; Value: string }[])
      : [];
    const rtRaw =
      ratings.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? null;
    const mcRaw =
      ratings
        .find((r) => r.Source === "Metacritic")
        ?.Value?.replace("/100", "") ?? null;
    const result: RatingsResult = {
      imdb_rating:
        typeof data.imdbRating === "string" && data.imdbRating !== "N/A"
          ? data.imdbRating
          : null,
      rotten_tomatoes:
        rtRaw && rtRaw !== "N/A" && rtRaw !== "0%" ? rtRaw : null,
      metacritic: mcRaw && mcRaw !== "N/A" && mcRaw !== "0" ? mcRaw : null,
    };
    await setJsonCache(cacheKey, result, 24 * 60 * 60);
    return result;
  } catch {
    return empty;
  }
}

export async function fetchCredits(
  apiKey: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<CreditsResult> {
  const cacheKey = `medias:credits:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<CreditsResult>(cacheKey);
  if (cached) return cached;

  const tmdbFetch = makeTmdbFetch(apiKey);
  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}/credits`);
    const castArr = Array.isArray(data?.cast)
      ? (data!.cast as Record<string, unknown>[])
      : [];
    const crewArr = Array.isArray(data?.crew)
      ? (data!.crew as Record<string, unknown>[])
      : [];
    const result: CreditsResult = {
      cast: castArr.slice(0, 10).map((m) => ({
        id: typeof m.id === "number" ? m.id : 0,
        name: typeof m.name === "string" ? m.name : "",
        character: typeof m.character === "string" ? m.character : null,
        profile_url:
          typeof m.profile_path === "string" && m.profile_path
            ? `https://image.tmdb.org/t/p/w185${m.profile_path}`
            : null,
      })),
      directors: crewArr
        .filter((m) => m.job === "Director")
        .map((m) => (typeof m.name === "string" ? m.name : ""))
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
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<DetailsResult> {
  const cacheKey = `medias:tmdb-details-v4:${mediaType}:${tmdbId}`;
  const cached = await getJsonCache<DetailsResult>(cacheKey);
  if (cached) return cached;

  const empty = emptyMediaDetails();
  const tmdbFetch = makeTmdbFetch(apiKey);

  try {
    const data = await tmdbFetch(`${mediaType}/${tmdbId}`, {
      append_to_response: "external_ids,images",
    });
    if (!data) return empty;

    const overview =
      typeof data.overview === "string" ? data.overview || null : null;
    const vote_average =
      typeof data.vote_average === "number" ? data.vote_average : null;
    const tagline =
      typeof data.tagline === "string" && data.tagline.trim()
        ? data.tagline.trim()
        : null;

    const genres: TmdbGenre[] = Array.isArray(data.genres)
      ? (data.genres as unknown[])
          .map((g) => {
            const gr = toRecord(g);
            if (!gr) return null;
            const id = toNumberOrNull(gr.id);
            const name = toStringOrNull(gr.name);
            if (id == null || !name) return null;
            return { id, name };
          })
          .filter((g): g is TmdbGenre => g !== null)
      : [];

    const original_title = toStringOrNull(data.original_title);
    const original_language = toStringOrNull(data.original_language);

    const production_countries: TmdbProductionCountry[] = Array.isArray(
      data.production_countries,
    )
      ? (data.production_countries as unknown[])
          .map((c) => {
            const r = toRecord(c);
            if (!r) return null;
            const iso = toStringOrNull(r.iso_3166_1);
            const name = toStringOrNull(r.name);
            if (!iso || !name) return null;
            return { iso_3166_1: iso, name };
          })
          .filter((x): x is TmdbProductionCountry => x !== null)
      : [];

    const production_companies: TmdbProductionCompany[] = Array.isArray(
      data.production_companies,
    )
      ? (data.production_companies as unknown[])
          .map((c) => {
            const r = toRecord(c);
            if (!r) return null;
            const id = toNumberOrNull(r.id);
            const name = toStringOrNull(r.name);
            if (id == null || !name) return null;
            const logo = toStringOrNull(r.logo_path);
            return {
              id,
              name,
              logo_url: logo ? `${IMG_COMPANY}${logo}` : null,
              origin_country: toStringOrNull(r.origin_country),
            };
          })
          .filter((x): x is TmdbProductionCompany => x !== null)
      : [];

    const spoken_languages: TmdbSpokenLanguage[] = Array.isArray(
      data.spoken_languages,
    )
      ? (data.spoken_languages as unknown[])
          .map((c) => {
            const r = toRecord(c);
            if (!r) return null;
            const en = toStringOrNull(r.english_name);
            const iso = toStringOrNull(r.iso_639_1);
            const name = toStringOrNull(r.name);
            if (!iso || !name) return null;
            return {
              english_name: en || name,
              iso_639_1: iso,
              name,
            };
          })
          .filter((x): x is TmdbSpokenLanguage => x !== null)
      : [];

    const original_language_label = languageLabel(
      original_language,
      spoken_languages,
    );

    const budget =
      typeof data.budget === "number" && data.budget > 0 ? data.budget : null;
    const revenue =
      typeof data.revenue === "number" && data.revenue > 0
        ? data.revenue
        : null;

    const homepage = toStringOrNull(data.homepage);

    const extParsed = parseExternalIds(data.external_ids);
    const imdbFallback = toStringOrNull(data.imdb_id);
    const mergedExternal: TmdbExternalIds = {
      imdb_id: extParsed?.imdb_id ?? imdbFallback,
      facebook_id: extParsed?.facebook_id ?? null,
      instagram_id: extParsed?.instagram_id ?? null,
      twitter_id: extParsed?.twitter_id ?? null,
      wikidata_id: extParsed?.wikidata_id ?? null,
    };
    const hasExternal =
      mergedExternal.imdb_id ||
      mergedExternal.facebook_id ||
      mergedExternal.instagram_id ||
      mergedExternal.twitter_id ||
      mergedExternal.wikidata_id;
    const external_ids: TmdbExternalIds | null = hasExternal
      ? mergedExternal
      : null;

    const imagesRaw = toRecord(data.images);
    const media_stills: TmdbMediaStills = {
      backdrops: parseImageStills(imagesRaw, "backdrop"),
      logos: parseImageStills(imagesRaw, "logo"),
      posters: parseImageStills(imagesRaw, "poster"),
    };

    const backdropPath = toStringOrNull(data.backdrop_path);
    const primary_backdrop_url = backdropPath
      ? `${IMG_BACKDROP}${backdropPath}`
      : null;

    let runtime: number | null = null;
    let belongs_to_collection: TmdbMediaDetailsResponse["belongs_to_collection"] =
      null;
    let number_of_seasons: number | null = null;
    let number_of_episodes: number | null = null;

    let release_date: string | null = null;
    let first_air_date: string | null = null;
    let last_air_date: string | null = null;
    let status: string | null =
      typeof data.status === "string" && data.status.trim()
        ? data.status.trim()
        : null;

    let tv_type: string | null = null;
    const networks: TmdbNetwork[] = [];
    const created_by: TmdbCreator[] = [];
    let episode_run_times: number[] = [];
    let next_episode_to_air: TmdbNextEpisode | null = null;
    let last_episode_to_air: TmdbNextEpisode | null = null;
    let seasons: TmdbSeasonSummary[] = [];

    if (mediaType === "movie") {
      const rd =
        typeof data.release_date === "string" ? data.release_date.trim() : "";
      release_date = /^\d{4}-\d{2}-\d{2}$/.test(rd) ? rd : null;
      runtime = typeof data.runtime === "number" ? data.runtime : null;
      const col = data.belongs_to_collection as Record<string, unknown> | null;
      if (col && typeof col === "object") {
        belongs_to_collection = {
          id: typeof col.id === "number" ? col.id : 0,
          name: typeof col.name === "string" ? col.name : "",
          poster_url:
            typeof col.poster_path === "string" && col.poster_path
              ? `https://image.tmdb.org/t/p/w185${col.poster_path}`
              : null,
        };
      }
    } else {
      tv_type = toStringOrNull(data.type);
      const fa =
        typeof data.first_air_date === "string"
          ? data.first_air_date.trim()
          : "";
      first_air_date = /^\d{4}-\d{2}-\d{2}$/.test(fa) ? fa : null;
      const la =
        typeof data.last_air_date === "string" ? data.last_air_date.trim() : "";
      last_air_date = /^\d{4}-\d{2}-\d{2}$/.test(la) ? la : null;

      const episodeRunTime = Array.isArray(data.episode_run_time)
        ? (data.episode_run_time as number[])
        : [];
      episode_run_times = episodeRunTime.filter(
        (n) => typeof n === "number" && n > 0,
      );
      runtime = episode_run_times.length > 0 ? episode_run_times[0] : null;
      number_of_seasons =
        typeof data.number_of_seasons === "number"
          ? data.number_of_seasons
          : null;
      number_of_episodes =
        typeof data.number_of_episodes === "number"
          ? data.number_of_episodes
          : null;

      if (Array.isArray(data.networks)) {
        for (const n of data.networks as unknown[]) {
          const r = toRecord(n);
          if (!r) continue;
          const id = toNumberOrNull(r.id);
          const name = toStringOrNull(r.name);
          if (id == null || !name) continue;
          const logo = toStringOrNull(r.logo_path);
          networks.push({
            id,
            name,
            logo_url: logo ? `${IMG_LOGO_STILL}${logo}` : null,
          });
        }
      }

      if (Array.isArray(data.created_by)) {
        for (const c of data.created_by as unknown[]) {
          const r = toRecord(c);
          if (!r) continue;
          const id = toNumberOrNull(r.id);
          const name = toStringOrNull(r.name);
          if (id == null || !name) continue;
          const pp = toStringOrNull(r.profile_path);
          created_by.push({
            id,
            name,
            profile_url: pp ? `${IMG_PROFILE}${pp}` : null,
          });
        }
      }

      next_episode_to_air = parseNextEpisode(data.next_episode_to_air);
      last_episode_to_air = parseNextEpisode(data.last_episode_to_air);

      if (Array.isArray(data.seasons)) {
        for (const raw of data.seasons as unknown[]) {
          const r = toRecord(raw);
          if (!r) continue;
          const season_number =
            typeof r.season_number === "number" ? r.season_number : null;
          if (season_number === null) continue;
          const rawName = toStringOrNull(r.name);
          const name =
            rawName && rawName.trim()
              ? rawName.trim()
              : season_number === 0
                ? "Specials"
                : `Season ${season_number}`;
          const ep = r.episode_count;
          const episode_count = typeof ep === "number" && ep >= 0 ? ep : null;
          seasons.push({ season_number, name, episode_count });
        }
        seasons.sort((a, b) => a.season_number - b.season_number);
      }
    }

    const result: TmdbMediaDetailsResponse = {
      runtime,
      belongs_to_collection,
      overview,
      vote_average,
      number_of_seasons,
      number_of_episodes,
      release_date: mediaType === "movie" ? release_date : null,
      tagline,
      genres,
      first_air_date: mediaType === "tv" ? first_air_date : null,
      last_air_date: mediaType === "tv" ? last_air_date : null,
      status,
      original_title,
      original_language,
      original_language_label,
      production_countries,
      production_companies,
      spoken_languages,
      budget: mediaType === "movie" ? budget : null,
      revenue: mediaType === "movie" ? revenue : null,
      homepage,
      external_ids,
      primary_backdrop_url,
      media_stills,
      tv_type: mediaType === "tv" ? tv_type : null,
      networks: mediaType === "tv" ? networks : [],
      created_by: mediaType === "tv" ? created_by : [],
      episode_run_times: mediaType === "tv" ? episode_run_times : [],
      next_episode_to_air: mediaType === "tv" ? next_episode_to_air : null,
      last_episode_to_air: mediaType === "tv" ? last_episode_to_air : null,
      seasons: mediaType === "tv" ? seasons : [],
    };
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
  release_date: string | null;
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
    const url = new URL(
      `https://api.themoviedb.org/3/collection/${collectionId}`,
    );
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "en-US");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
    const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";

    const parts = Array.isArray(data.parts)
      ? (data.parts as Record<string, unknown>[])
      : [];
    const result: TmdbCollectionData = {
      id: typeof data.id === "number" ? data.id : collectionId,
      name: typeof data.name === "string" ? data.name : "",
      overview:
        typeof data.overview === "string" ? data.overview || null : null,
      poster_url:
        typeof data.poster_path === "string" && data.poster_path
          ? `${POSTER_BASE}${data.poster_path}`
          : null,
      backdrop_url:
        typeof data.backdrop_path === "string" && data.backdrop_path
          ? `${BACKDROP_BASE}${data.backdrop_path}`
          : null,
      parts: parts
        .map((p) => {
          const tmdb_id = typeof p.id === "number" ? p.id : null;
          if (!tmdb_id) return null;
          const dateStr =
            typeof p.release_date === "string" ? p.release_date : "";
          const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
          return {
            tmdb_id,
            title: typeof p.title === "string" ? p.title : "",
            release_year: year && !isNaN(year) ? year : null,
            release_date: dateStr || null,
            poster_url:
              typeof p.poster_path === "string" && p.poster_path
                ? `${POSTER_BASE}${p.poster_path}`
                : null,
            overview:
              typeof p.overview === "string" ? p.overview || null : null,
            vote_average:
              typeof p.vote_average === "number" ? p.vote_average : null,
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
  mediaType: "movie" | "tv",
  tmdbId: number,
  region: string,
): Promise<TmdbWatchProvidersResult> {
  const cacheKey = `medias:providers:${mediaType}:${tmdbId}:${region}`;
  const cached = await getJsonCache<TmdbWatchProvidersResult>(cacheKey);
  if (cached) return cached;

  const LOGO_BASE = "https://image.tmdb.org/t/p/w92";
  const empty: TmdbWatchProvidersResult = {
    region,
    streaming: [],
    free: [],
    rent: [],
    buy: [],
    link: null,
  };

  try {
    const url = new URL(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`,
    );
    url.searchParams.set("api_key", apiKey);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return empty;

    const data = (await res.json()) as Record<string, unknown>;
    const results = toRecord(data.results);
    const regionData = toRecord(results?.[region]);

    const mapProviders = (raw: unknown[]): TmdbProvider[] => {
      const seen = new Set<number>();
      return raw
        .map((item) => {
          const p = toRecord(item);
          if (!p) return null;
          const id =
            typeof p.provider_id === "number"
              ? Math.trunc(p.provider_id)
              : null;
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
        ? mapProviders(
            Array.isArray(regionData.flatrate)
              ? (regionData.flatrate as unknown[])
              : [],
          )
        : [],
      free: regionData
        ? mapProviders(
            Array.isArray(regionData.free)
              ? (regionData.free as unknown[])
              : [],
          )
        : [],
      rent: regionData
        ? mapProviders(
            Array.isArray(regionData.rent)
              ? (regionData.rent as unknown[])
              : [],
          )
        : [],
      buy: regionData
        ? mapProviders(
            Array.isArray(regionData.buy) ? (regionData.buy as unknown[]) : [],
          )
        : [],
      link: regionData ? toStringOrNull(regionData.link) : null,
    };
    await setJsonCache(cacheKey, result, 6 * 60 * 60);
    return result;
  } catch {
    return empty;
  }
}
