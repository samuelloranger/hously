import { fetchApi } from "../../lib/api";

export interface ExportDataResponse {
  exported_at: string;
  chores: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  shopping_items: Array<Record<string, unknown>>;
  task_completions: Array<Record<string, unknown>>;
}

export interface ImportDataResponse {
  success: boolean;
  imported: {
    chores: number;
    reminders: number;
    shopping_items: number;
    task_completions: number;
  };
  warnings?: string[] | null;
}

export interface TriggerActionResponse {
  success: boolean;
  message: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
  func: string;
}

export interface ScheduledJobsResponse {
  scheduler_running: boolean;
  jobs: ScheduledJob[];
  message?: string;
}

export interface CreateUserRequest {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  is_admin?: boolean;
  locale?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    is_admin: boolean;
    locale: string;
  };
  password: string;
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

export interface User {
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
  users: User[];
}

export interface DeleteUserResponse {
  success: boolean;
  message: string;
}

export const adminApi = {
  async exportData(): Promise<ExportDataResponse> {
    return fetchApi<ExportDataResponse>(`/api/admin/export`);
  },

  async importData(data: Record<string, unknown>): Promise<ImportDataResponse> {
    return fetchApi<ImportDataResponse>(`/api/admin/import`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async triggerAction(action: string): Promise<TriggerActionResponse> {
    return fetchApi<TriggerActionResponse>(`/api/admin/trigger-action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  async getScheduledJobs(): Promise<ScheduledJobsResponse> {
    return fetchApi<ScheduledJobsResponse>(`/api/admin/scheduled-jobs`);
  },

  async getUsers(): Promise<ListUsersResponse> {
    return fetchApi<ListUsersResponse>(`/api/admin/users`);
  },

  async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return fetchApi<CreateUserResponse>(`/api/admin/users`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(userId: number): Promise<DeleteUserResponse> {
    return fetchApi<DeleteUserResponse>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  },

  async getTestEmailTemplates(): Promise<TestEmailTemplatesResponse> {
    return fetchApi<TestEmailTemplatesResponse>(
      `/api/admin/test-email-templates`,
    );
  },

  async testEmail(templateId?: string): Promise<TestEmailResponse> {
    return fetchApi<TestEmailResponse>(`/api/admin/test-email`, {
      method: "POST",
      body: JSON.stringify({ template_id: templateId || "test" }),
    });
  },
};
