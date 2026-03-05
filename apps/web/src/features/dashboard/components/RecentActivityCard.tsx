import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardActivities } from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';
import { ListItemSkeleton } from '../../../components/Skeleton';

type ActivityRow = { icon: string; description: string; time: string };

export function RecentActivityCard() {
  const { t, i18n } = useTranslation('common');
  const { data: activitiesData, isLoading } = useDashboardActivities();

  const rawActivities = activitiesData?.activities || [];
  const locale = resolveDateFnsLocale(i18n.language);

  const activities: ActivityRow[] = useMemo(() => {
    return rawActivities
      .map(activity => {
        if (activity.type === 'app_updated') {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const fromVersion = activity.from_version ?? '';
          const toVersion = activity.to_version ?? '';
          const description =
            fromVersion && toVersion
              ? t('dashboard.activity.appUpdated', { from: fromVersion, to: toVersion })
              : t('dashboard.activity.appUpdatedGeneric');
          return { icon: '✨', description, time };
        }

        if (activity.type === 'admin_triggered_job') {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const jobName = activity.job_name || activity.job_id || t('dashboard.activity.unknownJob');
          const description = t('dashboard.activity.adminTriggeredJob', { job: jobName });
          return { icon: '🛠️', description, time };
        }

        if (activity.type === 'cron_job_skipped') {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const jobName = activity.job_name || activity.job_id || t('dashboard.activity.unknownJob');
          const reason = activity.reason || t('dashboard.activity.unknownReason');
          const description = t('dashboard.activity.cronSkipped', { job: jobName, reason });
          return { icon: '⏭️', description, time };
        }

        if (activity.type === 'plugin_updated') {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const pluginType = activity.plugin_type || t('dashboard.activity.unknownPlugin');
          const description = t('dashboard.activity.pluginUpdated', { plugin: pluginType });
          return { icon: '🔌', description, time };
        }

        if (activity.type === 'cron_job_ended') {
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
          return { icon: activity.success === false ? '❌' : '✅', description, time };
        }

        if (
          activity.type === 'recipe_added' ||
          activity.type === 'recipe_updated' ||
          activity.type === 'recipe_deleted'
        ) {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const recipeName = activity.recipe_name || t('dashboard.activity.unknownRecipe');
          const description =
            activity.type === 'recipe_added'
              ? t('dashboard.activity.recipeAdded', { recipe: recipeName })
              : activity.type === 'recipe_updated'
                ? t('dashboard.activity.recipeUpdated', { recipe: recipeName })
                : t('dashboard.activity.recipeDeleted', { recipe: recipeName });
          return { icon: '🍳', description, time };
        }

        if (
          activity.type === 'event_created' ||
          activity.type === 'event_updated' ||
          activity.type === 'event_deleted'
        ) {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          const eventTitle = activity.event_title || t('dashboard.activity.unknownEvent');
          const description =
            activity.type === 'event_created'
              ? t('dashboard.activity.eventCreated', { event: eventTitle })
              : activity.type === 'event_updated'
                ? t('dashboard.activity.eventUpdated', { event: eventTitle })
                : t('dashboard.activity.eventDeleted', { event: eventTitle });
          return { icon: '📅', description, time };
        }

        if (
          activity.type === 'shopping_item_added' ||
          activity.type === 'shopping_item_completed' ||
          activity.type === 'shopping_list_cleared'
        ) {
          const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
          if (activity.type === 'shopping_list_cleared') {
            const count = typeof activity.count === 'number' && Number.isFinite(activity.count) ? activity.count : 0;
            return { icon: '🧹', description: t('dashboard.activity.shoppingCleared', { count }), time };
          }

          const itemName = activity.item_name || t('dashboard.activity.unknownItem');
          const description =
            activity.type === 'shopping_item_added'
              ? t('dashboard.activity.shoppingItemAdded', { item: itemName })
              : t('dashboard.activity.shoppingItemCompleted', { item: itemName });
          return { icon: '🛒', description, time };
        }

        const username = activity.username || t('dashboard.activity.unknownUser');
        const taskName = activity.task_name || t('dashboard.activity.unknownTask');
        const time = formatRelativeTime(activity.completed_at ?? null, { locale }) ?? '';
        const icon = activity.task_type === 'shopping' ? '🛒' : activity.task_type === 'recipe' ? '🍳' : '✅';
        const description = t('dashboard.activity.completed', { user: username, task: taskName });
        return { icon, description, time };
      })
      .filter(activity => activity.description.trim().length > 0);
  }, [rawActivities, t, locale]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-neutral-200/60 dark:border-neutral-700/50">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100/80 dark:bg-blue-900/30 text-[11px]">
          ⏰
        </div>
        <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">{t('dashboard.recentActivity')}</h3>
      </div>
      <div className="p-3.5">
        <div className="space-y-3">
          {isLoading ? (
            <>
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
            </>
          ) : activities.length > 0 ? (
            activities.map((activity, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-neutral-100/60 dark:hover:bg-neutral-700/40"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-700/60 text-[11px]">
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-800 dark:text-neutral-200">{activity.description}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="text-xl text-neutral-300 dark:text-neutral-600 mb-3 block">⏰</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('dashboard.noRecentActivity')}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{t('dashboard.startUsing')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
