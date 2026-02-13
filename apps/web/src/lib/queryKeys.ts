/**
 * Centralized query keys for React Query
 * This ensures consistency and makes it easier to invalidate related queries
 */
export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
    all: ['auth'] as const,
  },

  // Shopping
  shopping: {
    all: ['shopping'] as const,
    items: () => [...queryKeys.shopping.all] as const,
  },

  // Chores
  chores: {
    all: ['chores'] as const,
    list: () => [...queryKeys.chores.all] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    activities: () => [...queryKeys.dashboard.all, 'activities'] as const,
    jellyfinLatest: () => [...queryKeys.dashboard.all, 'jellyfin-latest'] as const,
    upcoming: () => [...queryKeys.dashboard.all, 'upcoming'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    weeklySummary: (locale?: string) => [...queryKeys.analytics.all, 'weekly-summary', locale || 'en'] as const,
    personalInsights: () => [...queryKeys.analytics.all, 'personal-insights'] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    devices: () => [...queryKeys.notifications.all, 'devices'] as const,
    list: (page?: number, limit?: number, read?: boolean) =>
      [...queryKeys.notifications.all, 'list', page, limit, read] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },

  // External Notifications
  externalNotifications: {
    all: ['external-notifications'] as const,
    services: () => [...queryKeys.externalNotifications.all, 'services'] as const,
    logs: () => [...queryKeys.externalNotifications.all, 'logs'] as const,
  },

  // Plugins
  plugins: {
    all: ['plugins'] as const,
    jellyfin: () => [...queryKeys.plugins.all, 'jellyfin'] as const,
  },

  // Admin
  admin: {
    all: ['admin'] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    export: () => [...queryKeys.admin.all, 'export'] as const,
  },

  // Calendar
  calendar: {
    all: ['calendar'] as const,
    events: (year?: number, month?: number) => [...queryKeys.calendar.all, 'events', year, month] as const,
  },

  // Recipes
  recipes: {
    all: ['recipes'] as const,
    list: () => [...queryKeys.recipes.all] as const,
    detail: (id: number) => [...queryKeys.recipes.all, 'detail', id] as const,
  },

  // Meal Plans
  mealPlans: {
    all: ['mealPlans'] as const,
    list: (start_date?: string, end_date?: string) =>
      [...queryKeys.mealPlans.all, 'list', start_date, end_date] as const,
  },
} as const;
