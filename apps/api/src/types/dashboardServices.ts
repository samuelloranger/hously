export interface DashboardScrutinyDrive {
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

export interface DashboardScrutinySummary {
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
  summary: DashboardScrutinySummary;
  drives: DashboardScrutinyDrive[];
  error?: string;
}

export interface DashboardBeszelDiskUsage {
  mount_point: string;
  model: string | null;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

export interface DashboardBeszelSummary {
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
  summary: DashboardBeszelSummary;
  disks: DashboardBeszelDiskUsage[];
  error?: string;
}

export interface DashboardNetdataDiskUsage {
  mount_point: string;
  used_gib: number;
  avail_gib: number;
  reserved_gib: number;
  used_percent: number;
}

export interface DashboardNetdataSummary {
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
  summary: DashboardNetdataSummary;
  disks: DashboardNetdataDiskUsage[];
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
