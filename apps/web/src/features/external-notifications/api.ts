import { fetchApi } from "../../lib/api";

export interface NotificationTemplate {
  id: number;
  service_id: number;
  service_name?: string;
  event_type: string;
  language: string;
  title_template: string;
  body_template: string;
  variables?: Record<string, string>;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExternalNotificationService {
  id: number;
  service_name: string;
  enabled: boolean;
  token: string | null;
  notify_admins_only: boolean;
  webhook_url: string | null;
  templates: NotificationTemplate[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ServicesResponse {
  services: ExternalNotificationService[];
}

export interface TemplatesResponse {
  templates: NotificationTemplate[];
}

export interface ServiceResponse {
  success: boolean;
  service: Omit<ExternalNotificationService, "templates">;
}

export interface TemplateResponse {
  success: boolean;
  template: NotificationTemplate;
}

export interface ExternalNotificationServiceLog {
  id: number;
  service_id: number;
  service_name: string | null;
  event_type: string;
  status: "success" | "failure" | "pending";
  payload: string;
  created_at: string | null;
}

export interface LogsResponse {
  logs: ExternalNotificationServiceLog[];
}

// Elysia API endpoints (migrated from Python)
const EXTERNAL_NOTIFICATIONS_API = "/api/external-notifications";

export const externalNotificationsApi = {
  async getServices(): Promise<ServicesResponse> {
    return fetchApi<ServicesResponse>(`${EXTERNAL_NOTIFICATIONS_API}/services`);
  },

  async enableService(serviceId: number): Promise<ServiceResponse> {
    return fetchApi<ServiceResponse>(
      `${EXTERNAL_NOTIFICATIONS_API}/services/${serviceId}/enable`,
      {
        method: "POST",
      }
    );
  },

  async disableService(serviceId: number): Promise<ServiceResponse> {
    return fetchApi<ServiceResponse>(
      `${EXTERNAL_NOTIFICATIONS_API}/services/${serviceId}/disable`,
      {
        method: "POST",
      }
    );
  },

  async regenerateToken(serviceId: number): Promise<ServiceResponse> {
    return fetchApi<ServiceResponse>(
      `${EXTERNAL_NOTIFICATIONS_API}/services/${serviceId}/regenerate-token`,
      {
        method: "POST",
      }
    );
  },

  async updateNotifyAdminsOnly(
    serviceId: number,
    notifyAdminsOnly: boolean
  ): Promise<ServiceResponse> {
    return fetchApi<ServiceResponse>(
      `${EXTERNAL_NOTIFICATIONS_API}/services/${serviceId}/notify-admins-only`,
      {
        method: "POST",
        body: JSON.stringify({ notify_admins_only: notifyAdminsOnly }),
      }
    );
  },

  // Templates (migrated to Elysia)
  async getTemplates(): Promise<TemplatesResponse> {
    return fetchApi<TemplatesResponse>(`${EXTERNAL_NOTIFICATIONS_API}/templates`);
  },

  async updateTemplate(
    templateId: number,
    data: { title_template?: string; body_template?: string }
  ): Promise<TemplateResponse> {
    return fetchApi<TemplateResponse>(
      `${EXTERNAL_NOTIFICATIONS_API}/templates/${templateId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  async getLogs(): Promise<LogsResponse> {
    return fetchApi<LogsResponse>(`${EXTERNAL_NOTIFICATIONS_API}/services/logs`);
  },
};
