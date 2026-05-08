export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  updated_at: string;
}

export interface AppSettingsResponse {
  settings: AppSettings;
}

export interface UpdateAppSettingsRequest {
  country_code: string;
  calendar_subdivision_code?: string | null;
}
