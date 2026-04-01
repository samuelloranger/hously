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
  /** Short rationale from local LLM (Explore AI suggestions). */
  ai_reason?: string | null;
}

export interface AiMediaSuggestionsResponse {
  items: TmdbMediaSearchItem[];
  model: string;
}

export interface AiMediaSuggestionsConfigResponse {
  enabled: boolean;
  ready: boolean;
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

export interface MediaRefreshResponse {
  success: boolean;
  service: 'radarr' | 'sonarr';
}

/** Single movie file row from Radarr (when downloaded) */
export interface ArrManagementFileInfo {
  relative_path: string | null;
  size_bytes: number | null;
  quality_label: string | null;
  custom_format_score: number | null;
  date_added: string | null;
  languages: string[];
  scene_name: string | null;
  media_resolution: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  audio_channels: string | null;
  edition: string | null;
  release_group: string | null;
}

export interface ArrManagementStatistics {
  episode_file_count: number;
  episode_count: number;
  total_episode_count: number;
  size_on_disk_bytes: number;
  percent_of_episodes: number;
}

/** Normalized Radarr movie / Sonarr series payload for the Management tab */
export interface ArrManagementDetailsResponse {
  service: 'radarr' | 'sonarr';
  title: string;
  sort_title: string | null;
  path: string | null;
  root_folder_path: string | null;
  monitored: boolean;
  arr_status: string | null;
  added: string | null;
  genres: string[];
  studio: string | null;
  has_file: boolean;
  file: ArrManagementFileInfo | null;
  series_type: string | null;
  season_folder: boolean;
  statistics: ArrManagementStatistics | null;
  network: string | null;
}

export interface TmdbStreamingProvider {
  id: number;
  name: string;
  logo_url: string;
}

export interface TmdbStreamingProvidersResponse {
  providers: TmdbStreamingProvider[];
}

export interface TmdbTrailerResponse {
  key: string | null;
  name: string | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbGenresResponse {
  genres: TmdbGenre[];
}

export interface DiscoverMediasParams {
  type: 'movie' | 'tv';
  provider_id?: number | null;
  genre_id?: number | null;
  sort_by?: string;
  page?: number;
  language?: string;
  region?: string;
  original_language?: string | null;
}

export interface DiscoverMediasResponse {
  items: TmdbMediaSearchItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface MediaRatingsResponse {
  imdb_rating: string | null;
  rotten_tomatoes: string | null;
  metacritic: string | null;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface TmdbCreditsResponse {
  cast: TmdbCastMember[];
  directors: string[];
}

export interface TmdbCollection {
  id: number;
  name: string;
  poster_url: string | null;
}

export interface TmdbProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbProductionCompany {
  id: number;
  name: string;
  logo_url: string | null;
  origin_country: string | null;
}

export interface TmdbSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TmdbExternalIds {
  imdb_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
  wikidata_id: string | null;
}

export interface TmdbImageStill {
  url: string;
  width: number | null;
  height: number | null;
  vote_average: number | null;
}

export interface TmdbMediaStills {
  backdrops: TmdbImageStill[];
  logos: TmdbImageStill[];
  posters: TmdbImageStill[];
}

export interface TmdbNextEpisode {
  name: string | null;
  air_date: string | null;
  episode_number: number | null;
  season_number: number | null;
  runtime: number | null;
}

export interface TmdbNetwork {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface TmdbCreator {
  id: number;
  name: string;
  profile_url: string | null;
}

/** TV show only: season rows from TMDB details `seasons` (incl. specials as season 0). */
export interface TmdbSeasonSummary {
  season_number: number;
  /** Display name from TMDB (e.g. "Season 1", "Specials"). */
  name: string;
  episode_count: number | null;
}

export interface TmdbMediaDetailsResponse {
  runtime: number | null;
  belongs_to_collection: TmdbCollection | null;
  overview: string | null;
  vote_average: number | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  /** YYYY-MM-DD from TMDB (movies only) */
  release_date: string | null;
  tagline: string | null;
  genres: TmdbGenre[];
  /** TV: YYYY-MM-DD */
  first_air_date: string | null;
  last_air_date: string | null;
  /** Movie or TV status string from TMDB */
  status: string | null;

  original_title: string | null;
  /** ISO 639-1 code */
  original_language: string | null;
  /** Best-effort display name for original language */
  original_language_label: string | null;
  production_countries: TmdbProductionCountry[];
  production_companies: TmdbProductionCompany[];
  spoken_languages: TmdbSpokenLanguage[];

  /** Movies: USD from TMDB */
  budget: number | null;
  revenue: number | null;

  homepage: string | null;
  external_ids: TmdbExternalIds | null;

  /** Primary backdrop (from main `backdrop_path`) */
  primary_backdrop_url: string | null;
  media_stills: TmdbMediaStills;

  /** TV: Scripted, Documentary, etc. */
  tv_type: string | null;
  networks: TmdbNetwork[];
  created_by: TmdbCreator[];
  episode_run_times: number[];
  next_episode_to_air: TmdbNextEpisode | null;
  last_episode_to_air: TmdbNextEpisode | null;

  /** TV: ordered by `season_number` (movies: empty). */
  seasons: TmdbSeasonSummary[];
}

export interface WatchlistItem {
  id: number;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_url: string | null;
  overview: string | null;
  release_year: number | null;
  vote_average: number | null;
  added_at: string;
  /** Cached TMDB release date for movies (YYYY-MM-DD); used for day-before reminders */
  movie_release_date: string | null;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

/** Sonarr episode on disk (hasFile), for TV modal when the series is in the library. */
export interface MediaLibraryEpisodeRef {
  season_number: number;
  episode_number: number;
}

export interface MediaModalLibraryEpisodes {
  /** True when Sonarr is configured and this TMDB show exists in Sonarr. */
  in_library: boolean;
  /** Episodes with a file on disk; empty when none or not in library. */
  downloaded: MediaLibraryEpisodeRef[];
}

export interface MediaModalDataResponse {
  watchlist_status: boolean;
  watchlist_id: number | null;
  trailer: TmdbTrailerResponse;
  ratings: MediaRatingsResponse;
  credits: TmdbCreditsResponse;
  details: TmdbMediaDetailsResponse;
  providers: TmdbWatchProvidersResponse;
  /** TV: Sonarr download state; null for movies. */
  library_episodes: MediaModalLibraryEpisodes | null;
}

export interface CollectionMovieItem {
  id: string;
  tmdb_id: number;
  media_type: 'movie';
  title: string;
  release_year: number | null;
  release_date: string | null;
  poster_url: string | null;
  overview: string | null;
  vote_average: number | null;
  service: 'radarr';
  already_exists: boolean;
  can_add: boolean;
  source_id: number | null;
  arr_url: string | null;
}

export interface MediaCollection {
  id: number;
  name: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  movies: CollectionMovieItem[];
  owned_count: number;
  total_count: number;
  missing_count: number;
}

export interface MissingCollectionsResponse {
  collections: MediaCollection[];
}
