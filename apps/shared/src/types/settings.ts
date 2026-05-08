export interface DashboardWidgetVisibility {
  weather: boolean;
  homeassistant: boolean;
  system: boolean;
  downloads: boolean;
  rss: boolean;
}

export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  upcoming_window_months: number;
  upcoming_languages: string;
  dashboard_widget_visibility: DashboardWidgetVisibility;
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
