export const EXTERNAL_NOTIFICATION_ENDPOINTS = {
  SERVICES: '/api/external-notifications/services',
  ENABLE_SERVICE: (serviceId: number) => `/api/external-notifications/services/${serviceId}/enable`,
  DISABLE_SERVICE: (serviceId: number) => `/api/external-notifications/services/${serviceId}/disable`,
  REGENERATE_TOKEN: (serviceId: number) => `/api/external-notifications/services/${serviceId}/regenerate-token`,
  UPDATE_NOTIFY_ADMINS_ONLY: (serviceId: number) =>
    `/api/external-notifications/services/${serviceId}/notify-admins-only`,
  TEMPLATES: '/api/external-notifications/templates',
  TEMPLATE: (templateId: number) => `/api/external-notifications/templates/${templateId}`,
  LOGS: '/api/external-notifications/services/logs',
} as const;
