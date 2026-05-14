export interface DashboardStats {
  events_today: number;
  chores_count: number;
  habits_streak: number;
}

export type ActivityType =
  | "task_completed"
  | "chore_added"
  | "chore_completed"
  | "habit_completed"
  | "integration_updated"
  | "cron_job_ended"
  | "cron_job_skipped"
  | "app_updated"
  | "admin_triggered_job"
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "media_grab"
  | (string & {});

export interface Activity {
  id?: number;
  user_id?: string;
  task_type?: "chore";
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
  integration_type?: string;
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
  event_id?: number;
  event_title?: string;
  item_name?: string;
  count?: number;
  media_id?: number;
  episode_id?: number;
  release_title?: string;
}

export interface ActivityDisplay {
  description: string;
  time: string;
  icon: string;
  type: ActivityType;
}

export interface DashboardStatsResponse {
  stats: DashboardStats;
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
  library_id: number | null;
  season_number: number | null;
  episode_number: number | null;
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
  items: DashboardUpcomingItem[];
}

export interface DashboardUpcomingStatusResponse {
  exists: boolean;
  library_id: number | null;
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

export interface RssIndexerStat {
  name: string;
  releases_found: number;
}

export interface RssRunResult {
  status: "success" | "error";
  started_at: string;
  completed_at: string;
  releases_found: number;
  releases_grabbed: number;
  indexers: RssIndexerStat[];
  error: string | null;
}

export interface RssStatusResponse {
  /** Server clock (ISO) — align client-relative math so wrong OS time does not skew RSS UI */
  server_time: string;
  last_run: RssRunResult | null;
  history: RssRunResult[];
  next_run_at: string | null;
}
