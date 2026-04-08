export type LibraryMediaStatus =
  | "wanted"
  | "downloading"
  | "downloaded"
  | "skipped";

export interface LibraryAudioTrack {
  index: number;
  language: string;
  language_name: string;
  title: string | null;
  codec: string | null;
  channels: number | null;
  channel_layout: string | null;
  bitrate_kbps: number | null;
  default: boolean;
  forced: boolean;
}

export interface LibrarySubtitleTrack {
  index: number;
  language: string;
  language_name: string;
  title: string | null;
  format: string | null;
  forced: boolean;
  hearing_impaired: boolean;
}

export interface LibraryFileInfo {
  id: number;
  file_name: string;
  file_path: string;
  size_bytes: string;
  duration_secs: number | null;
  release_group: string | null;
  video_codec: string | null;
  video_profile: string | null;
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  bit_depth: number | null;
  video_bitrate: number | null;
  hdr_format: string | null;
  resolution: number | null;
  source: string | null;
  audio_tracks: LibraryAudioTrack[];
  subtitle_tracks: LibrarySubtitleTrack[];
  scanned_at: string;
  season: number | null;
  episode: number | null;
  episode_title: string | null;
}

export interface LibraryFilesResponse {
  media_type: "movie" | "show";
  files: LibraryFileInfo[];
}
export type LibraryMediaType = "movie" | "show";

export interface LibraryQualityProfileRef {
  id: number;
  name: string;
}

export interface LibraryMedia {
  id: number;
  tmdb_id: number;
  type: LibraryMediaType;
  title: string;
  sort_title: string | null;
  year: number | null;
  status: LibraryMediaStatus;
  poster_url: string | null;
  overview: string | null;
  digital_release_date: string | null;
  quality_profile_id: number | null;
  search_attempts: number;
  quality_profile: LibraryQualityProfileRef | null;
  added_at: string;
  updated_at: string;
}

export interface LibraryListResponse {
  items: LibraryMedia[];
}

export interface AddToLibraryRequest {
  tmdb_id: number;
  type: LibraryMediaType;
}

export interface AddToLibraryResponse {
  item: LibraryMedia;
}

export interface LibraryEpisode {
  id: number;
  season: number;
  episode: number;
  title: string | null;
  air_date: string | null;
  status: LibraryMediaStatus;
  tmdb_episode_id: number | null;
  downloaded_at: string | null;
  search_attempts: number;
}

export interface LibrarySeasonGroup {
  season: number;
  episodes: LibraryEpisode[];
}

export interface LibraryEpisodesResponse {
  seasons: LibrarySeasonGroup[];
}

export interface MigrateLibraryRequest {
  source: "radarr" | "sonarr" | "both";
  radarr_url?: string;
  radarr_api_key?: string;
  sonarr_url?: string;
  sonarr_api_key?: string;
}

export interface MigrateLibraryEnqueueResponse {
  job_id: string | undefined;
}

export interface MigrateJobProgress {
  phase: "radarr" | "sonarr" | "done";
  current: number;
  total: number;
  current_title: string | null;
  radarr: {
    imported: number;
    already_existed: number;
    skipped: number;
    files_scanned: number;
    errors: number;
  };
  sonarr: {
    imported_shows: number;
    imported_episodes: number;
    imported_files: number;
    files_scanned: number;
    errors: number;
  };
}

export interface MigrateJobResult {
  radarr?: {
    imported: number;
    already_existed: number;
    skipped: number;
    files_scanned: number;
    errors: string[];
  };
  sonarr?: {
    imported_shows: number;
    imported_episodes: number;
    imported_files: number;
    files_scanned: number;
    errors: string[];
  };
}

export interface MigrateJobStatus {
  job_id: string | null;
  state: "waiting" | "active" | "completed" | "failed" | "unknown";
  progress: MigrateJobProgress | null;
  result: MigrateJobResult | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface LibraryDownloadHistoryItem {
  id: number;
  release_title: string;
  indexer: string | null;
  torrent_hash: string | null;
  grabbed_at: string;
  completed_at: string | null;
  failed: boolean;
  fail_reason: string | null;
  episode_id: number | null;
  post_process_error?: string | null;
  post_process_destination_path?: string | null;
}

export type MediaFileOperation = "hardlink" | "move";

export interface MediaPostProcessingSettings {
  movies_library_path: string | null;
  shows_library_path: string | null;
  file_operation: MediaFileOperation;
  movie_template: string;
  episode_template: string;
  min_seed_ratio: number;
  post_processing_enabled: boolean;
  default_quality_profile_id: number | null;
  updated_at: string;
}

export interface MediaPostProcessingSettingsResponse {
  settings: MediaPostProcessingSettings;
}

export interface UpdateMediaPostProcessingSettingsRequest {
  movies_library_path?: string | null;
  shows_library_path?: string | null;
  file_operation?: MediaFileOperation;
  movie_template?: string;
  episode_template?: string;
  min_seed_ratio?: number;
  post_processing_enabled?: boolean;
  default_quality_profile_id?: number | null;
}

export interface LibraryScanRequest {
  path: string;
  type: "movie" | "show";
}

export interface LibraryScanResponse {
  matched: number;
  unmatched: string[];
}

export interface LibraryDownloadsResponse {
  items: LibraryDownloadHistoryItem[];
}

export interface LibrarySearchResponse {
  grabbed: boolean;
  release_title?: string;
  reason?: string;
}
