export interface ExportDataResponse {
  exported_at: string;
  chores: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  task_completions: Array<Record<string, unknown>>;
}

export interface ImportDataResponse {
  success: boolean;
  imported: {
    chores: number;
    reminders: number;
    task_completions: number;
  };
  warnings?: string[] | null;
}

export interface TriggerActionResponse {
  success: boolean;
  message: string;
}

export interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface ScheduledJob {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
  status: string | null;
}

export interface ScheduledJobsResponse {
  scheduler_running: boolean;
  queues: QueueStat[];
  jobs: ScheduledJob[];
  message?: string;
}

export type LibraryHealthRunStatus = "success" | "failed" | "skipped";

export interface LibraryHealthSummary {
  downloaded_media_without_files: number;
  downloaded_episodes_without_files: number;
  missing_file_paths: number;
  stale_tmdb_statuses: number;
  episode_number_mismatches: number;
  total_issues: number;
}

export interface LibraryHealthIssue {
  kind:
    | "downloaded_media_without_files"
    | "downloaded_episode_without_files"
    | "missing_file_path"
    | "stale_tmdb_status"
    | "episode_number_mismatch";
  media_id?: number;
  episode_id?: number;
  media_file_id?: number;
  tmdb_id?: number;
  tmdb_episode_id?: number;
  title?: string;
  media_type?: string;
  season?: number;
  episode?: number;
  expected_season?: number;
  expected_episode?: number;
  path?: string;
  tmdb_status?: string | null;
  tmdb_status_refreshed_at?: string | null;
  detail: string;
}

export interface LibraryHealthLog {
  id: number;
  status: LibraryHealthRunStatus | string;
  trigger: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  summary: LibraryHealthSummary;
  issues: LibraryHealthIssue[];
  warnings: string[];
  error: string | null;
}

export interface LibraryHealthHistoryEntry {
  id: number;
  status: string;
  trigger: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  /** JSON from DB — use `issue_count` for list display */
  summary: unknown;
  issue_count: number;
  warnings: string[];
  error: string | null;
}

export interface LibraryHealthResponse {
  latest: LibraryHealthLog | null;
  history: LibraryHealthHistoryEntry[];
}

export interface QueueJob {
  id: string;
  name: string;
  data: unknown;
  opts: unknown;
  progress: number | object;
  delay: number;
  timestamp: string;
  processedOn: string | null;
  finishedOn: string | null;
  status: string;
  returnValue: unknown;
  failedReason: string | null;
  stacktrace: string[];
  attemptsMade: number;
}

export interface InviteUserRequest {
  email: string;
  is_admin?: boolean;
  locale?: string;
}

export interface Invitation {
  id: number;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  is_admin: boolean;
  locale: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  invited_by_email?: string;
  invited_by_name?: string | null;
}

export interface InviteUserResponse {
  success: boolean;
  invitation: Invitation;
}

export interface ListInvitationsResponse {
  success: boolean;
  invitations: Invitation[];
}

export interface ResendInvitationResponse {
  success: boolean;
  message: string;
}

export interface RevokeInvitationResponse {
  success: boolean;
  message: string;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  email?: string;
  error?: string;
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  body: string;
  url: string | null;
  notification_type: string;
}

export interface TestEmailTemplatesResponse {
  templates: EmailTemplate[];
}

export interface AdminUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  locale: string;
  created_at: string | null;
  last_login: string | null;
}

export interface ListUsersResponse {
  success: boolean;
  users: AdminUser[];
}

export interface DeleteUserResponse {
  success: boolean;
  message: string;
}

export interface AdminSession {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string | null;
  expires_at: string;
  created_at: string;
}

export interface AdminSessionsResponse {
  success: boolean;
  sessions: AdminSession[];
}

export interface RevokeSessionResponse {
  success: boolean;
  message: string;
}

export interface AdminWebPushSubscription {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string | null;
  endpoint: string | null;
  device_name: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  platform: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminWebPushResponse {
  success: boolean;
  subscriptions: AdminWebPushSubscription[];
}

export interface DeleteWebPushResponse {
  success: boolean;
  message: string;
}

export interface RetryJobResponse {
  success: boolean;
  message: string;
}

export interface RetryFailedResponse {
  success: boolean;
  message: string;
  retried: number;
}

export interface CleanQueueResponse {
  success: boolean;
  message: string;
  cleaned: number;
}

export interface JobHistoryEntry {
  id: string;
  name: string;
  queue: string;
  status: string;
  timestamp: string;
  processed_on: string | null;
  finished_on: string | null;
  duration: number | null;
  failed_reason: string | null;
  attempts_made: number;
}

export interface JobHistoryResponse {
  jobs: JobHistoryEntry[];
}
