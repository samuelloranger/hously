import type { WidgetVisibility, WidgetLayout, TileLayout } from "../constants";

export interface QuickLink {
  id: string;
  label: string;
  url: string;
}

export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  upcoming_window_months: number;
  upcoming_languages: string;
  dashboard_widget_visibility: WidgetVisibility;
  dashboard_widget_layout: WidgetLayout | null;
  dashboard_tile_layout: TileLayout | null;
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
  dashboard_widget_visibility?: WidgetVisibility;
  dashboard_widget_layout?: WidgetLayout;
  dashboard_tile_layout?: TileLayout;
}
