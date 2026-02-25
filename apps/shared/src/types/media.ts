export interface MediaItem {
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
  downloading: boolean;
  added_at: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  tvdb_id: number | null;
  season_count: number | null;
  episode_count: number | null;
  poster_url: string | null;
  arr_url: string | null;
}

export interface MediasResponse {
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
  radarr_connected: boolean;
  sonarr_connected: boolean;
  items: MediaItem[];
  errors?: {
    radarr?: string;
    sonarr?: string;
  };
}

export interface TmdbMediaSearchItem {
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
}

export interface TmdbMediaSearchResponse {
  enabled: boolean;
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
  items: TmdbMediaSearchItem[];
  errors?: {
    radarr?: string;
    sonarr?: string;
  };
}

export interface TmdbWatchProvider {
  id: number;
  name: string;
  logo_url: string;
}

export interface TmdbWatchProvidersResponse {
  region: string;
  streaming: TmdbWatchProvider[];
  free: TmdbWatchProvider[];
  rent: TmdbWatchProvider[];
  buy: TmdbWatchProvider[];
  link: string | null;
}

export interface MediaAutoSearchResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
}

export interface InteractiveReleaseItem {
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
}

export interface MediaInteractiveSearchResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
  releases: InteractiveReleaseItem[];
}

export interface ExploreMediasResponse {
  trending: TmdbMediaSearchItem[];
  popular_movies: TmdbMediaSearchItem[];
  popular_shows: TmdbMediaSearchItem[];
  upcoming_movies: TmdbMediaSearchItem[];
  now_playing: TmdbMediaSearchItem[];
  airing_today: TmdbMediaSearchItem[];
  on_the_air: TmdbMediaSearchItem[];
  top_rated_movies: TmdbMediaSearchItem[];
  top_rated_shows: TmdbMediaSearchItem[];
  recommended: TmdbMediaSearchItem[];
}

export interface SimilarMediasResponse {
  items: TmdbMediaSearchItem[];
}

export interface MediaInteractiveDownloadResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
}

export interface MediaDeleteResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
}
