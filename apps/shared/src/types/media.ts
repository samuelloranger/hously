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
  release_tags: string[] | null;
  latest_conversion?: MediaConversionJob | null;
}

export interface MediasResponse {
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
  radarr_connected: boolean;
  sonarr_connected: boolean;
  c411_enabled: boolean;
  c411_tmdb_ids: number[];
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
  source: 'arr' | 'prowlarr';
  download_token?: string | null;
}

export interface MediaInteractiveSearchResponse {
  success: boolean;
  service: 'radarr' | 'sonarr' | 'prowlarr';
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
  service: 'radarr' | 'sonarr' | 'prowlarr';
}

export interface MediaDeleteResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
}

export type MediaConversionStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface MediaConversionPreset {
  key: string;
  label: string;
  description: string;
  output_extension: 'mkv' | 'mp4';
  target_height: number | null;
  target_video_codec: 'hevc' | 'h264';
  crf: number;
  ffmpeg_preset: string;
  copy_audio: boolean;
  copy_subtitles: boolean;
}

export interface MediaConversionSourceInfo {
  file_size_bytes: number;
  duration_seconds: number | null;
  container: string | null;
  video_codec: string | null;
  width: number | null;
  height: number | null;
  pix_fmt: string | null;
  hdr: boolean;
  dolby_vision: boolean;
  audio_streams: number;
  subtitle_streams: number;
}

export interface MediaConversionValidation {
  can_convert: boolean;
  reasons: string[];
  warnings: string[];
  input_path: string;
  output_path: string;
  source: MediaConversionSourceInfo;
}

export interface MediaConversionJob {
  id: number;
  service: 'radarr' | 'sonarr';
  source_id: number;
  source_title: string | null;
  preset: string;
  status: MediaConversionStatus;
  input_path: string;
  output_path: string;
  progress: number;
  duration_seconds: number | null;
  processed_seconds: number | null;
  eta_seconds: number | null;
  fps: number | null;
  speed: string | null;
  error_message: string | null;
  validation_summary: MediaConversionValidation | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  requested_by_user_id: number | null;
}

export interface MediaConversionPreviewResponse {
  service: 'radarr' | 'sonarr';
  source_id: number;
  source_title: string;
  preset: MediaConversionPreset;
  available_presets: MediaConversionPreset[];
  validation: MediaConversionValidation;
}

export interface MediaConversionJobsResponse {
  jobs: MediaConversionJob[];
}

export interface MediaConversionCreateResponse {
  job: MediaConversionJob;
}
