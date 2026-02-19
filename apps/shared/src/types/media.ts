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
  added_at: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  tvdb_id: number | null;
  season_count: number | null;
  episode_count: number | null;
  poster_url: string | null;
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
  service: 'radarr' | 'sonarr';
  already_exists: boolean;
  can_add: boolean;
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
