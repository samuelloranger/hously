import type { Locale } from 'date-fns';
import type { TFunction } from 'i18next';
import type { Activity } from '@hously/shared';
import { formatRelativeTime } from '@hously/shared';

export interface ActivityPresentation {
  icon: string;
  description: string;
  time: string;
  type: string;
  typeLabel: string;
  service: string;
  serviceLabel: string;
}

const SERVICE_LABEL_KEYS: Record<string, string> = {
  chores: 'dashboard.activityPage.services.chores',
  shopping: 'dashboard.activityPage.services.shopping',
  recipes: 'dashboard.activityPage.services.recipes',
  calendar: 'dashboard.activityPage.services.calendar',
  habits: 'dashboard.activityPage.services.habits',
  system: 'dashboard.activityPage.services.system',
  admin: 'dashboard.activityPage.services.admin',
  weather: 'dashboard.activityPage.services.weather',
  tmdb: 'dashboard.activityPage.services.tmdb',
  jellyfin: 'dashboard.activityPage.services.jellyfin',
  qbittorrent: 'dashboard.activityPage.services.qbittorrent',
  scrutiny: 'dashboard.activityPage.services.scrutiny',
  beszel: 'dashboard.activityPage.services.beszel',
  adguard: 'dashboard.activityPage.services.adguard',
  prowlarr: 'dashboard.activityPage.services.prowlarr',
  radarr: 'dashboard.activityPage.services.radarr',
  sonarr: 'dashboard.activityPage.services.sonarr',
  reddit: 'dashboard.activityPage.services.reddit',
  hackernews: 'dashboard.activityPage.services.hackernews',
  c411: 'dashboard.activityPage.services.c411',
  torr9: 'dashboard.activityPage.services.torr9',
  'la-cale': 'dashboard.activityPage.services.laCale',
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  task_completed: 'dashboard.activityPage.types.task_completed',
  chore_completed: 'dashboard.activityPage.types.chore_completed',
  shopping_completed: 'dashboard.activityPage.types.shopping_completed',
  habit_completed: 'dashboard.activityPage.types.habit_completed',
  recipe_completed: 'dashboard.activityPage.types.recipe_completed',
  plugin_updated: 'dashboard.activityPage.types.plugin_updated',
  cron_job_ended: 'dashboard.activityPage.types.cron_job_ended',
  cron_job_skipped: 'dashboard.activityPage.types.cron_job_skipped',
  app_updated: 'dashboard.activityPage.types.app_updated',
  recipe_added: 'dashboard.activityPage.types.recipe_added',
  recipe_updated: 'dashboard.activityPage.types.recipe_updated',
  recipe_deleted: 'dashboard.activityPage.types.recipe_deleted',
  admin_triggered_job: 'dashboard.activityPage.types.admin_triggered_job',
  event_created: 'dashboard.activityPage.types.event_created',
  event_updated: 'dashboard.activityPage.types.event_updated',
  event_deleted: 'dashboard.activityPage.types.event_deleted',
  shopping_item_added: 'dashboard.activityPage.types.shopping_item_added',
  shopping_item_completed: 'dashboard.activityPage.types.shopping_item_completed',
  shopping_list_cleared: 'dashboard.activityPage.types.shopping_list_cleared',
};

function titleize(value: string): string {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getActivityType(activity: Activity): string {
  if (activity.type) return activity.type;

  switch (activity.task_type) {
    case 'chore':
      return 'chore_completed';
    case 'shopping':
      return 'shopping_completed';
    case 'recipe':
      return 'recipe_completed';
    default:
      return 'task_completed';
  }
}

export function getActivityService(activity: Activity): string {
  if (activity.service?.trim()) return activity.service.trim().toLowerCase();

  switch (activity.task_type) {
    case 'chore':
      return 'chores';
    case 'shopping':
      return 'shopping';
    case 'recipe':
      return 'recipes';
    default:
      return 'system';
  }
}

export function getActivityTypeLabel(t: TFunction<'common'>, type: string): string {
  const key = TYPE_LABEL_KEYS[type];
  if (key) return t(key);
  return titleize(type);
}

export function getActivityServiceLabel(t: TFunction<'common'>, service: string): string {
  const normalized = service.trim().toLowerCase();
  const key = SERVICE_LABEL_KEYS[normalized];
  if (key) return t(key);
  return titleize(normalized);
}

export function getActivityPresentation(
  activity: Activity,
  t: TFunction<'common'>,
  locale: Locale
): ActivityPresentation | null {
  const type = getActivityType(activity);
  const service = getActivityService(activity);

  if (type === 'app_updated') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const fromVersion = activity.from_version ?? '';
    const toVersion = activity.to_version ?? '';
    const description =
      fromVersion && toVersion
        ? t('dashboard.activity.appUpdated', { from: fromVersion, to: toVersion })
        : t('dashboard.activity.appUpdatedGeneric');
    return {
      icon: '✨',
      description,
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'admin_triggered_job') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const jobName = activity.job_name || activity.job_id || t('dashboard.activity.unknownJob');
    return {
      icon: '🛠️',
      description: t('dashboard.activity.adminTriggeredJob', { job: jobName }),
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'cron_job_skipped') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const jobName = activity.job_name || activity.job_id || t('dashboard.activity.unknownJob');
    const reason = activity.reason || t('dashboard.activity.unknownReason');
    return {
      icon: '⏭️',
      description: t('dashboard.activity.cronSkipped', { job: jobName, reason }),
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'plugin_updated') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const pluginType = activity.plugin_type || t('dashboard.activity.unknownPlugin');
    return {
      icon: '🔌',
      description: t('dashboard.activity.pluginUpdated', { plugin: pluginType }),
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'cron_job_ended') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const jobName = activity.job_name || activity.job_id || t('dashboard.activity.unknownJob');
    const seconds =
      typeof activity.duration_ms === 'number' && Number.isFinite(activity.duration_ms)
        ? Math.max(0, Math.round(activity.duration_ms / 1000))
        : null;
    const description =
      activity.success === false
        ? t('dashboard.activity.cronFailed', { job: jobName })
        : t('dashboard.activity.cronEnded', { job: jobName, seconds: seconds ?? 0 });
    return {
      icon: activity.success === false ? '❌' : '✅',
      description,
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'recipe_added' || type === 'recipe_updated' || type === 'recipe_deleted') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const recipeName = activity.recipe_name || t('dashboard.activity.unknownRecipe');
    const description =
      type === 'recipe_added'
        ? t('dashboard.activity.recipeAdded', { recipe: recipeName })
        : type === 'recipe_updated'
          ? t('dashboard.activity.recipeUpdated', { recipe: recipeName })
          : t('dashboard.activity.recipeDeleted', { recipe: recipeName });
    return {
      icon: '🍳',
      description,
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'event_created' || type === 'event_updated' || type === 'event_deleted') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    const eventTitle = activity.event_title || t('dashboard.activity.unknownEvent');
    const description =
      type === 'event_created'
        ? t('dashboard.activity.eventCreated', { event: eventTitle })
        : type === 'event_updated'
          ? t('dashboard.activity.eventUpdated', { event: eventTitle })
          : t('dashboard.activity.eventDeleted', { event: eventTitle });
    return {
      icon: '📅',
      description,
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  if (type === 'shopping_item_added' || type === 'shopping_item_completed' || type === 'shopping_list_cleared') {
    const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
    if (type === 'shopping_list_cleared') {
      const count = typeof activity.count === 'number' && Number.isFinite(activity.count) ? activity.count : 0;
      return {
        icon: '🧹',
        description: t('dashboard.activity.shoppingCleared', { count }),
        time,
        type,
        typeLabel: getActivityTypeLabel(t, type),
        service,
        serviceLabel: getActivityServiceLabel(t, service),
      };
    }

    const itemName = activity.item_name || t('dashboard.activity.unknownItem');
    const description =
      type === 'shopping_item_added'
        ? t('dashboard.activity.shoppingItemAdded', { item: itemName })
        : t('dashboard.activity.shoppingItemCompleted', { item: itemName });
    return {
      icon: '🛒',
      description,
      time,
      type,
      typeLabel: getActivityTypeLabel(t, type),
      service,
      serviceLabel: getActivityServiceLabel(t, service),
    };
  }

  const username = activity.username || t('dashboard.activity.unknownUser');
  const taskName = activity.task_name || t('dashboard.activity.unknownTask');
  const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
  const icon = activity.task_type === 'shopping' ? '🛒' : activity.task_type === 'recipe' ? '🍳' : '✅';

  return {
    icon,
    description: t('dashboard.activity.completed', { user: username, task: taskName }),
    time,
    type,
    typeLabel: getActivityTypeLabel(t, type),
    service,
    serviceLabel: getActivityServiceLabel(t, service),
  };
}
