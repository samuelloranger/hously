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
