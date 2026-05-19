import type { WidgetVisibility, WidgetLayout } from "../constants/widgets";

export interface QuickLink {
  id: string;
  label: string;
  url: string;
}

export type DashboardWidgetVisibility = WidgetVisibility;

export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  upcoming_window_months: number;
  upcoming_languages: string;
  dashboard_widget_visibility: DashboardWidgetVisibility;
  dashboard_widget_layout: WidgetLayout | null;
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
  dashboard_widget_layout?: WidgetLayout;
}
