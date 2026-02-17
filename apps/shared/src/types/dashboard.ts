export interface DashboardStats {
  events_today: number;
  shopping_count: number;
  chores_count: number;
  monthly_total: number;
}

export interface Activity {
  id?: number;
  user_id?: number;
  task_type?: 'chore' | 'shopping' | 'recipe';
  task_id?: number;
  completed_at?: string;
  task_name?: string;
  emotion?: string | null;
  username?: string;
  description?: string;
  time?: string;
  icon?: string;
  type?: 'shopping_added' | 'shopping_completed' | 'chore_added' | 'chore_completed';
}

export interface ActivityDisplay {
  description: string;
  time: string;
  icon: string;
  type: 'shopping_added' | 'shopping_completed' | 'chore_added' | 'chore_completed';
}

export interface DashboardStatsResponse {
  stats: DashboardStats;
  activities: Activity[];
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
  media_type: 'movie' | 'tv';
  release_date: string | null;
  poster_url: string | null;
  tmdb_url: string;
  providers: DashboardUpcomingProvider[];
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
  page: number;
  limit: number;
  has_more: boolean;
}

export interface DashboardUpcomingStatusResponse {
  exists: boolean;
  service: 'radarr' | 'sonarr';
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

export interface NetdataDashboardDiskUsage {
  mount_point: string;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

export interface NetdataDashboardSummary {
  cpu_percent: number | null;
  ram_used_mib: number | null;
  ram_total_mib: number | null;
  ram_used_percent: number | null;
  load_1: number | null;
  load_5: number | null;
  load_15: number | null;
  network_in_kbps: number | null;
  network_out_kbps: number | null;
}

export interface DashboardNetdataSummaryResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  summary: NetdataDashboardSummary;
  disks: NetdataDashboardDiskUsage[];
  error?: string;
}
