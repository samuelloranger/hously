export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  locale?: string | null;
  /** ISO 3166-1 alpha-2; must be supported by date-holidays when set */
  country_code?: string | null;
  /** Province/state code from date-holidays (e.g. QC); optional */
  calendar_subdivision_code?: string | null;
  last_login: string | null;
  created_at: string;
  last_activity: string | null;
  avatar_url?: string | null;
  has_passkey?: boolean;
}

export interface UserResponse {
  user: User | null;
}

export interface UsersResponse {
  users: User[];
}

export interface UpdateProfileRequest {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  country_code?: string | null;
  calendar_subdivision_code?: string | null;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
