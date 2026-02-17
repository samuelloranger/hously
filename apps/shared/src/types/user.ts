export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  locale?: string | null;
  last_login: string | null;
  created_at: string;
  last_activity: string | null;
  avatar_url?: string | null;
  dashboard_config?: DashboardConfigV1 | null;
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
  dashboard_config?: DashboardConfigV1 | null;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export type DashboardCardSize = 'half' | 'full';

export interface DashboardCardConfig {
  id: string;
  size: DashboardCardSize;
}

export interface DashboardConfigV1 {
  version: 1;
  cards: DashboardCardConfig[];
}
