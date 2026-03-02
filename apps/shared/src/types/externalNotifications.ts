export interface NotificationTemplate {
  id: number;
  service_id: number;
  service_name?: string;
  event_type: string;
  language: string;
  title_template: string;
  body_template: string;
  enabled: boolean;
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
  service: Omit<ExternalNotificationService, 'templates'>;
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
  status: 'success' | 'failure' | 'pending';
  payload: string;
  created_at: string | null;
}

export interface LogsResponse {
  logs: ExternalNotificationServiceLog[];
}
