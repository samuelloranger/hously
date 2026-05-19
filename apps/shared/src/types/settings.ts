export interface QuickLink {
  id: string;
  label: string;
  url: string;
}

export interface DashboardWidgetVisibility {
  weather: boolean;
  homeassistant: boolean;
  system: boolean;
  downloads: boolean;
  rss: boolean;
  minecraft: boolean;
}

export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  upcoming_window_months: number;
  upcoming_languages: string;
  dashboard_widget_visibility: DashboardWidgetVisibility;
  quick_links: QuickLink[];
  updated_at: string;
}

export interface AppSettingsResponse {
  settings: AppSettings;
}

export interface UpdateAppSettingsRequest {
  country_code?: string;
  calendar_subdivision_code?: string | null;
  upcoming_window_months?: number;
  upcoming_languages?: string;
  dashboard_widget_visibility?: DashboardWidgetVisibility;
}
