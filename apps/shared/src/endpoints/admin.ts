export const ADMIN_ENDPOINTS = {
  EXPORT: '/api/admin/export',
  IMPORT: '/api/admin/import',
  TRIGGER_ACTION: '/api/admin/trigger-action',
  SCHEDULED_JOBS: '/api/admin/scheduled-jobs',
  USERS: '/api/admin/users',
  DELETE_USER: (userId: number) => `/api/admin/users/${userId}`,
  TEST_EMAIL_TEMPLATES: '/api/admin/test-email-templates',
  TEST_EMAIL: '/api/admin/test-email',
} as const;
