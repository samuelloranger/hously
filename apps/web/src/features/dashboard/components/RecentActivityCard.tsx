import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardActivities, resolveDateFnsLocale } from '@hously/shared';
import { ListItemSkeleton } from '@/components/Skeleton';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { getActivityPresentation } from '../activityPresentation';

export function RecentActivityCard() {
  const { t, i18n } = useTranslation('common');
  const { data: activitiesData, isLoading } = useDashboardActivities(10);
  const prefetchRoute = usePrefetchRoute();

  const rawActivities = activitiesData?.activities || [];
  const locale = resolveDateFnsLocale(i18n.language);

  const activities = useMemo(() => {
    return rawActivities
      .map(activity => getActivityPresentation(activity, t, locale))
      .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity))
      .filter(activity => activity.description.trim().length > 0);
  }, [rawActivities, t, locale]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-neutral-200/60 dark:border-neutral-700/50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100/80 dark:bg-blue-900/30 text-[10px]">
            ⏰
          </div>
          <h3 className="text-[11px] font-semibold text-neutral-900 dark:text-white">{t('dashboard.recentActivity')}</h3>
        </div>
        <Link
          to="/activity"
          search={{ service: '', type: '' }}
          onMouseEnter={() => prefetchRoute('/activity')}
          onTouchStart={() => prefetchRoute('/activity')}
          className="text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('dashboard.activityPage.viewAll')}
        </Link>
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
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-700/60 text-[10px]">
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-neutral-800 dark:text-neutral-200">{activity.description}</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="text-lg text-neutral-300 dark:text-neutral-600 mb-3 block">⏰</span>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.noRecentActivity')}</p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{t('dashboard.startUsing')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
