export interface DashboardStats {
  events_today: number;
  shopping_count: number;
  chores_count: number;
  habits_streak: number;
}

export type ActivityType =
  | "task_completed"
  | "shopping_added"
  | "shopping_completed"
  | "chore_added"
  | "chore_completed"
  | "habit_completed"
  | "recipe_completed"
  | "plugin_updated"
  | "cron_job_ended"
  | "cron_job_skipped"
  | "app_updated"
  | "recipe_added"
  | "recipe_updated"
  | "recipe_deleted"
  | "admin_triggered_job"
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "shopping_item_added"
  | "shopping_item_completed"
  | "shopping_list_cleared"
  | (string & {});

export interface Activity {
  id?: number;
  user_id?: number;
  task_type?: "chore" | "shopping" | "recipe";
  task_id?: number;
  completed_at?: string;
  task_name?: string;
  emotion?: string | null;
  username?: string;
  description?: string;
  time?: string;
  icon?: string;
  type?: ActivityType;
  service?: string;
  plugin_type?: string;
  job_id?: string;
  job_name?: string;
  action?: string;
  success?: boolean;
  duration_ms?: number;
  message?: string;
  trigger?: string;
  reason?: string;
  from_version?: string;
  to_version?: string;
  recipe_id?: number;
  recipe_name?: string;
  event_id?: number;
  event_title?: string;
  shopping_item_id?: number;
  item_name?: string;
  count?: number;
}

export interface ActivityDisplay {
  description: string;
  time: string;
  icon: string;
  type: ActivityType;
}

export interface DashboardStatsResponse {
  stats: DashboardStats;
  activities: Activity[];
}

export interface DashboardActivityFeedResponse {
  activities: Activity[];
  available_services: string[];
  available_types: string[];
  total: number;
  limit: number;
  has_more: boolean;
}

export interface JellyfinLatestItem {
  id: string;
  title: string;
  subtitle: string | null;
  item_url: string | null;
  banner_url: string | null;
  poster_url: string | null;
  item_type: string | null;
  year: number | null;
  added_at: string | null;
}

export interface DashboardJellyfinLatestResponse {
  enabled: boolean;
  items: JellyfinLatestItem[];
  page: number;
  limit: number;
  has_more: boolean;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  tmdb_url: string | null;
  providers: DashboardUpcomingProvider[];
  vote_average?: number | null;
  popularity?: number;
}

export interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

export interface DashboardUpcomingResponse {
  enabled: boolean;
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
  items: DashboardUpcomingItem[];
}

export interface DashboardUpcomingStatusResponse {
  exists: boolean;
  service: "radarr" | "sonarr";
  can_add: boolean;
  source_id: number | null;
  arr_url: string | null;
}

export interface QbittorrentDashboardSummary {
  downloading_count: number;
  stalled_count: number;
  seeding_count: number;
  paused_count: number;
  completed_count: number;
  total_count: number;
  download_speed: number;
  upload_speed: number;
  downloaded_bytes: number;
  uploaded_bytes: number;
}

export interface QbittorrentDashboardTorrent {
  id: string;
  name: string;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds: number | null;
  size_bytes: number;
  state: string;
  seeds: number;
  peers: number;
}

export interface DashboardQbittorrentStatusResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  poll_interval_seconds: number;
  summary: QbittorrentDashboardSummary;
  torrents: QbittorrentDashboardTorrent[];
  error?: string;
}

export interface QbittorrentTorrentListItem extends QbittorrentDashboardTorrent {
  category: string | null;
  tags: string[];
  ratio: number | null;
  added_on: string | null;
  completed_on: string | null;
}

export interface DashboardQbittorrentTorrentsResponse {
  enabled: boolean;
  connected: boolean;
  torrents: QbittorrentTorrentListItem[];
  /** Total torrents matching the request (before pagination). */
  total_count: number;
  /** Zero-based offset of this page. */
  offset: number;
  /** Page size (max items returned). */
  limit: number;
  /** Session-wide speeds from qBittorrent (all torrents), bytes/sec. */
  download_speed?: number;
  upload_speed?: number;
  error?: string;
}

export interface DashboardQbittorrentTorrentStreamResponse {
  enabled: boolean;
  connected: boolean;
  torrent: QbittorrentTorrentListItem | null;
  error?: string;
}

export interface DashboardPinnedQbittorrentTorrentResponse {
  enabled: boolean;
  connected: boolean;
  pinned_hash: string | null;
  torrent: QbittorrentTorrentListItem | null;
  error?: string;
}

export interface QbittorrentCategory {
  name: string;
  save_path: string | null;
}

export interface DashboardQbittorrentCategoriesResponse {
  enabled: boolean;
  connected: boolean;
  categories: QbittorrentCategory[];
  error?: string;
}

export interface DashboardQbittorrentTagsResponse {
  enabled: boolean;
  connected: boolean;
  tags: string[];
  error?: string;
}

export interface DashboardQbittorrentOptionsResponse {
  enabled: boolean;
  connected: boolean;
  categories: QbittorrentCategory[];
  tags: string[];
  error?: string;
}

export interface QbittorrentTorrentProperties {
  save_path: string | null;
  total_size_bytes: number | null;
  piece_size_bytes: number | null;
  comment: string | null;
  creation_date: string | null;
  addition_date: string | null;
  completion_date: string | null;
  total_downloaded_bytes: number | null;
  total_uploaded_bytes: number | null;
  share_ratio: number | null;
}

export interface DashboardQbittorrentTorrentPropertiesResponse {
  enabled: boolean;
  connected: boolean;
  properties: QbittorrentTorrentProperties | null;
  error?: string;
}

export interface QbittorrentTorrentTracker {
  url: string;
  status: number | null;
  message: string | null;
  tier: number | null;
  peers: number | null;
  seeds: number | null;
  leeches: number | null;
  downloaded: number | null;
}

export interface DashboardQbittorrentTorrentTrackersResponse {
  enabled: boolean;
  connected: boolean;
  trackers: QbittorrentTorrentTracker[];
  error?: string;
}

export interface DashboardAdguardTopEntry {
  name: string;
  hits: number;
}

export interface DashboardAdguardSummary {
  dns_queries: number;
  blocked_queries: number;
  blocked_ratio: number | null;
  avg_processing_time_ms: number | null;
  safebrowsing_blocked: number;
  safesearch_rewritten: number;
  parental_blocked: number;
}

export interface DashboardAdguardSummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  protection_enabled: boolean;
  version: string | null;
  summary: DashboardAdguardSummary;
  top_blocked_domains: DashboardAdguardTopEntry[];
  top_clients: DashboardAdguardTopEntry[];
  error?: string;
}

export interface QbittorrentTorrentFile {
  index: number;
  name: string;
  size_bytes: number;
  progress: number;
  priority: number | null;
}

export interface DashboardQbittorrentTorrentFilesResponse {
  enabled: boolean;
  connected: boolean;
  files: QbittorrentTorrentFile[];
  error?: string;
}

export interface QbittorrentTorrentPeer {
  id: string;
  ip: string | null;
  port: number | null;
  client: string | null;
  connection: string | null;
  country_code: string | null;
  progress: number | null;
  relevance: number | null;
  downloaded_bytes: number | null;
  uploaded_bytes: number | null;
  download_speed: number | null;
  upload_speed: number | null;
  flags: string | null;
  flags_description: string | null;
  files: string | null;
}

export interface DashboardQbittorrentTorrentPeersResponse {
  enabled: boolean;
  connected: boolean;
  rid: number;
  full_update: boolean;
  peers: QbittorrentTorrentPeer[];
  error?: string;
}

export interface DashboardQbittorrentAddTorrentResponse {
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}

export interface DashboardQbittorrentMutationResponse {
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}

export interface ScrutinyDashboardDrive {
  id: string;
  model_name: string | null;
  serial_number: string | null;
  capacity_bytes: number | null;
  device_status: number | null;
  temperature_c: number | null;
  power_on_hours: number | null;
  firmware: string | null;
  form_factor: string | null;
  updated_at: string | null;
}

export interface ScrutinyDashboardSummary {
  total_drives: number;
  healthy_drives: number;
  warning_drives: number;
  avg_temp_c: number | null;
  hottest_temp_c: number | null;
}

export interface DashboardScrutinySummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: ScrutinyDashboardSummary;
  drives: ScrutinyDashboardDrive[];
  error?: string;
}

export interface BeszelDashboardDiskUsage {
  mount_point: string;
  model: string | null;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

export interface BeszelDashboardSummary {
  cpu_percent: number | null;
  cpu_name: string | null;
  ram_used_mib: number | null;
  ram_total_mib: number | null;
  ram_used_percent: number | null;
  load_1: number | null;
  load_5: number | null;
  load_15: number | null;
  network_in_kbps: number | null;
  network_out_kbps: number | null;
}

export interface DashboardBeszelSummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: BeszelDashboardSummary;
  disks: BeszelDashboardDiskUsage[];
  error?: string;
}

export interface DashboardTrackerStatsResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string | null;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  error?: string;
}

export type DashboardTrackersStatsResponse = Record<
  "c411" | "torr9" | "la-cale",
  DashboardTrackerStatsResponse
>;

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  subreddit: string;
  thumbnail: string | null;
  is_self: boolean;
}

export interface DashboardRedditResponse {
  enabled: boolean;
  posts: RedditPost[];
  subreddits: string[];
  after: string | null;
  updated_at: string;
  error?: string;
}

export interface HackerNewsStory {
  id: number;
  title: string;
  url: string | null;
  score: number;
  by: string;
  time: number;
  comment_count: number;
  type: "story" | "job" | "poll";
}

export interface DashboardHackerNewsResponse {
  enabled: boolean;
  stories: HackerNewsStory[];
  feed_type: string;
  updated_at: string;
  error?: string;
}
